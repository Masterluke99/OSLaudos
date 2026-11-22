from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json, sys
import re
import uuid
import hashlib
import base64
from io import BytesIO
from datetime import datetime
import subprocess
import webbrowser
import threading

sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_paths import get_data_root

if getattr(sys, "frozen", False):
    DATA_ROOT = get_data_root()
    ASSET_ROOT = Path(getattr(sys, "_MEIPASS", DATA_ROOT))
else:
    DATA_ROOT = get_data_root()
    ASSET_ROOT = DATA_ROOT

ROOT = DATA_ROOT
from database import connect, initialize_database

class AcquaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ASSET_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlparse(self.path).path == "/api/certificate-status":
            cert_dir = ROOT / "dados" / "certificados"
            return self.send_json(200, {
                "pfx": (cert_dir / "certificado.pfx").is_file(),
                "config": (cert_dir / "config.json").is_file(),
            })
        if urlparse(self.path).path == "/api/clients":
            with connect() as con:
                rows = con.execute("""
                    SELECT id, cliente, cnpj, endereco, responsavel_tecnico,
                           representante_nome, representante_cpf
                    FROM clientes ORDER BY cliente COLLATE NOCASE
                """).fetchall()
            result = [{
                "id": r["id"],
                "Cliente": r["cliente"],
                "CNPJ": r["cnpj"],
                "Endereco": r["endereco"],
                "Responsavel_Tecnico": r["responsavel_tecnico"],
                "Representante_Nome": r["representante_nome"],
                "Representante_CPF": r["representante_cpf"],
            } for r in rows]
            return self.send_json(200, result)
        if urlparse(self.path).path == "/api/measurement-imports":
            with connect() as con:
                rows = con.execute("""
                    SELECT id, nome_arquivo, periodo_referencia, quantidade, importado_em, arquivo_hash
                    FROM importacoes_medicoes
                    ORDER BY importado_em DESC
                """).fetchall()
            return self.send_json(200, [{
                "id": r["id"],
                "nome_arquivo": r["nome_arquivo"],
                "periodo_referencia": r["periodo_referencia"],
                "quantidade": r["quantidade"],
                "importado_em": r["importado_em"],
                "arquivo_hash": r["arquivo_hash"],
            } for r in rows])
        if urlparse(self.path).path == "/api/measurements":
            parsed_url = urlparse(self.path)
            query = parsed_url.query
            from urllib.parse import parse_qs
            filters = parse_qs(query)
            year = (filters.get("year") or [""])[0].strip()
            month = (filters.get("month") or [""])[0].strip()
            client_id = (filters.get("client") or [""])[0].strip()
            clauses = []
            params = []
            if year:
                clauses.append("ano = ?")
                params.append(int(year) if year.isdigit() else year)
            if month:
                clauses.append("mes = ?")
                params.append(int(month) if month.isdigit() else month)
            if client_id:
                clauses.append("cliente_id = ?")
                params.append(client_id)
            where = " WHERE " + " AND ".join(clauses) if clauses else ""
            with connect() as con:
                rows = con.execute("""
                    SELECT id, cliente_id, data_coleta, cloro_livre, ph, alcalinidade,
                           dureza_total, temperatura, aspecto_visual, avaliacao_tecnica,
                           local_coleta, dados_json, lote_id, periodo_referencia, ano, mes
                    FROM medicoes
                    """ + where + """
                    ORDER BY data_coleta DESC, criado_em DESC
                """, params).fetchall()
            result = []
            for r in rows:
                try:
                    row = json.loads(r["dados_json"])
                except json.JSONDecodeError:
                    row = {}
                row["_measurement_id"] = r["id"]
                row["_cliente_id"] = r["cliente_id"]
                row["_lote_id"] = r["lote_id"]
                row["_periodo"] = r["periodo_referencia"]
                row["_ano"] = r["ano"]
                row["_mes"] = r["mes"]
                result.append(row)
            return self.send_json(200, result)
        if urlparse(self.path).path == "/":
            self.path = "/Acquatec_laudos_sqlite.html"
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path == "/api/open-certificate-folder":
            cert_dir = ROOT / "dados" / "certificados"
            cert_dir.mkdir(parents=True, exist_ok=True)
            try:
                if sys.platform.startswith("win"):
                    subprocess.Popen(["explorer.exe", str(cert_dir)])
                elif sys.platform.startswith("darwin"):
                    subprocess.Popen(["open", str(cert_dir)])
                else:
                    subprocess.Popen(["xdg-open", str(cert_dir)])
                return self.send_json(200, {"ok": True, "path": str(cert_dir)})
            except Exception as exc:
                print(f"[AcquaTEC] Erro ao abrir pasta do certificado: {exc}", flush=True)
                return self.send_json(500, {"error": "Não foi possível abrir a pasta do certificado."})

        if urlparse(self.path).path == "/api/verify-pdf":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 50_000_000:
                    return self.send_json(413, {"error": "O PDF excede o limite permitido."})
                data = json.loads(self.rfile.read(length) or "{}")
                pdf_base64 = str(data.get("pdf") or "")
                if not pdf_base64:
                    return self.send_json(400, {"error": "Nenhum PDF foi enviado para validação."})
                pdf_bytes = base64.b64decode(pdf_base64, validate=True)

                from pyhanko.pdf_utils.reader import PdfFileReader
                from pyhanko.sign.validation import validate_pdf_signature

                reader = PdfFileReader(BytesIO(pdf_bytes))
                signatures = reader.embedded_signatures
                if not signatures:
                    return self.send_json(200, {
                        "signed": False,
                        "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
                    })

                results = []
                for signature in signatures:
                    status = validate_pdf_signature(signature)
                    results.append({
                        "intact": bool(status.intact),
                        "valid": bool(status.valid),
                        "trusted": bool(status.trusted),
                        "summary": status.summary(),
                    })
                valid = all(item["intact"] and item["valid"] for item in results)
                trusted = all(item["trusted"] for item in results)
                return self.send_json(200, {
                    "signed": True,
                    "valid": valid,
                    "trusted": trusted,
                    "sha256": hashlib.sha256(pdf_bytes).hexdigest(),
                    "signatures": results,
                })
            except Exception as exc:
                print(f"[AcquaTEC] Erro ao validar PDF: {type(exc).__name__}: {exc}", flush=True)
                return self.send_json(500, {"error": "Não foi possível validar o PDF."})

        if urlparse(self.path).path == "/api/sign-pdfs":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 50_000_000:
                    return self.send_json(413, {"error": "O lote de PDFs excede o limite permitido."})
                raw_body = self.rfile.read(length)
                body_text = (raw_body or b"{}").decode("utf-8")
                body_text = body_text.lstrip("\ufeff")
                try:
                    data = json.loads(body_text)
                except json.JSONDecodeError as exc:
                    print(f"[AcquaTEC] JSON inválido em assinatura: {exc}; bytes={len(raw_body)}; prefix={raw_body[:80]!r}", flush=True)
                    return self.send_json(400, {"error": "JSON inválido."})
                documents = data.get("documents") if isinstance(data, dict) else None
                if not isinstance(documents, list) or not documents:
                    return self.send_json(400, {"error": "Nenhum PDF foi enviado para assinatura."})

                cert_dir = ROOT / "dados" / "certificados"
                pfx_path = cert_dir / "certificado.pfx"
                config_path = cert_dir / "config.json"
                if not pfx_path.is_file():
                    return self.send_json(404, {"error": "Certificado PFX não encontrado."})
                if not config_path.is_file():
                    return self.send_json(404, {"error": "Configuração do certificado não encontrada."})
                with config_path.open("r", encoding="utf-8-sig") as config_file:
                    config = json.load(config_file)
                password = str(config.get("password") or "").encode("utf-8")
                if not password:
                    return self.send_json(400, {"error": "A senha do certificado não foi configurada."})

                try:
                    from pyhanko.sign import signers
                    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
                    from pyhanko.sign.signers.pdf_signer import PdfSigner, PdfSignatureMetadata
                    from pyhanko.sign.fields import SigFieldSpec
                    from pyhanko.stamp import StaticStampStyle
                    from pyhanko.pdf_utils import content
                    from reportlab.pdfgen import canvas
                    from reportlab.lib.utils import ImageReader
                    from reportlab.graphics.barcode import qr
                    from reportlab.graphics.shapes import Drawing
                    from reportlab.graphics import renderPDF
                except ImportError:
                    return self.send_json(500, {"error": "Dependências de assinatura não instaladas. Execute: py -3 -m pip install -r requirements-sign.txt"})

                signer = signers.SimpleSigner.load_pkcs12(
                    pfx_file=str(pfx_path),
                    passphrase=password,
                )
                signed_documents = []
                for index, document in enumerate(documents):
                    if not isinstance(document, dict):
                        continue
                    filename = str(document.get("filename") or f"Laudo_{index + 1}.pdf").strip()
                    pdf_base64 = str(document.get("pdf") or "")
                    if not pdf_base64:
                        continue
                    source = base64.b64decode(pdf_base64, validate=True)
                    source_sha256 = hashlib.sha256(source).hexdigest()
                    identifier = f"ACQ-{source_sha256[:12].upper()}"
                    output = BytesIO()
                    with BytesIO(source) as input_file:
                        writer = IncrementalPdfFileWriter(input_file)
                        seal_width = 350
                        seal_height = 72
                        seal_path = cert_dir / f"selo-assinatura-{index + 1}.pdf"
                        seal_canvas = canvas.Canvas(str(seal_path), pagesize=(seal_width, seal_height))
                        logo_path = ASSET_ROOT / "logo.png"
                        if logo_path.is_file():
                            seal_canvas.drawImage(
                                ImageReader(str(logo_path)),
                                8,
                                9,
                                width=54,
                                height=54,
                                preserveAspectRatio=True,
                                anchor="c",
                                mask="auto",
                            )
                        signed_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
                        seal_canvas.setFillColorRGB(0, 0.51, 0.64)
                        seal_canvas.setFont("Helvetica-Bold", 9)
                        seal_canvas.drawString(70, 55, "ASSINADO DIGITALMENTE")
                        seal_canvas.setFillColorRGB(0.20, 0.20, 0.20)
                        seal_canvas.setFont("Helvetica-Bold", 8)
                        seal_canvas.drawString(70, 42, "ANTONIO LUCAS TRIBURTINO")
                        seal_canvas.setFont("Helvetica", 8)
                        seal_canvas.drawString(70, 30, "CNPJ 17.601.076/0001-75")
                        seal_canvas.drawString(70, 18, f"{signed_at}  |  {identifier}")
                        qr_payload = f"ACQUATEC|{identifier}|SHA256:{source_sha256}|{filename}"
                        qr_code = qr.QrCodeWidget(qr_payload)
                        qr_bounds = qr_code.getBounds()
                        qr_width = qr_bounds[2] - qr_bounds[0]
                        qr_height = qr_bounds[3] - qr_bounds[1]
                        qr_drawing = Drawing(54, 54, transform=[54 / qr_width, 0, 0, 54 / qr_height, 0, 0])
                        qr_drawing.add(qr_code)
                        renderPDF.draw(qr_drawing, seal_canvas, 290, 9)
                        seal_canvas.save()
                        seal_style = StaticStampStyle(
                            background=content.ImportedPdfPage(str(seal_path), page_ix=0),
                            border_width=0,
                            background_opacity=1,
                        )
                        field_spec = SigFieldSpec(
                            sig_field_name=f"AssinaturaDigital{index + 1}",
                            on_page=-1,
                            box=((612 - seal_width) / 2, 18, (612 + seal_width) / 2, 18 + seal_height),
                        )
                        PdfSigner(
                            PdfSignatureMetadata(
                                field_name=f"AssinaturaDigital{index + 1}",
                                name="ANTONIO LUCAS TRIBURTINO",
                                location="Marília/SP",
                                reason="Assinatura digital do laudo técnico",
                            ),
                            signer=signer,
                            stamp_style=seal_style,
                            new_field_spec=field_spec,
                        ).sign_pdf(writer, output=output)
                        seal_path.unlink(missing_ok=True)
                    signed_documents.append({
                        "filename": filename,
                        "pdf": base64.b64encode(output.getvalue()).decode("ascii"),
                        "sha256": hashlib.sha256(output.getvalue()).hexdigest(),
                        "source_sha256": source_sha256,
                        "identifier": identifier,
                    })
                if len(signed_documents) != len(documents):
                    return self.send_json(400, {"error": "Um ou mais PDFs possuem conteúdo inválido."})
                return self.send_json(200, {"ok": True, "documents": signed_documents})
            except Exception as exc:
                print(f"[AcquaTEC] Erro ao assinar PDFs: {type(exc).__name__}: {exc}", flush=True)
                return self.send_json(500, {"error": "Não foi possível assinar o lote de PDFs."})

        if urlparse(self.path).path == "/api/restore":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 20_000_000:
                    return self.send_json(413, {"error": "Arquivo de backup excede o limite permitido."})
                data = json.loads(self.rfile.read(length) or "{}")
                if data.get("app") != "Acqua TEC":
                    return self.send_json(400, {"error": "Arquivo de backup inválido."})
                clients = data.get("clients")
                measurements = data.get("measurements")
                imports = data.get("measurement_imports")
                if not isinstance(clients, list) or not isinstance(measurements, list) or not isinstance(imports, list):
                    return self.send_json(400, {"error": "O backup está incompleto ou possui formato inválido."})

                client_rows = []
                for item in clients:
                    if not isinstance(item, dict) or not str(item.get("Cliente", "")).strip():
                        continue
                    client_id = str(item.get("id") or "").strip()
                    if not client_id:
                        return self.send_json(400, {"error": "Um ou mais clientes do backup estão sem identificador."})
                    client_rows.append((
                        client_id,
                        str(item.get("Cliente", "")).strip(),
                        str(item.get("CNPJ", "")).strip(),
                        str(item.get("Endereco", "")).strip(),
                        str(item.get("Responsavel_Tecnico", "")).strip(),
                        str(item.get("Representante_Nome", "")).strip(),
                        str(item.get("Representante_CPF", "")).strip(),
                    ))

                measurement_rows = []
                for item in measurements:
                    if not isinstance(item, dict):
                        continue
                    measurement_id = str(item.get("_measurement_id") or "").strip()
                    client_id = str(item.get("_cliente_id") or "").strip()
                    if not measurement_id or not client_id:
                        continue

                    def val(*keys):
                        for key in keys:
                            for found in item:
                                if str(found).strip().lower() == key.lower():
                                    return str(item[found] or "").strip()
                        return ""

                    year = item.get("_ano")
                    month = item.get("_mes")
                    measurement_rows.append((
                        measurement_id,
                        client_id,
                        val("Carimbo de data/hora", "Data/Hora", "Data", "Data_Coleta"),
                        str(item.get("_lote_id") or ""),
                        str(item.get("_periodo") or ""),
                        int(year) if isinstance(year, int) else None,
                        int(month) if isinstance(month, int) else None,
                        val("Cloro Livre", "Cloro Livre mg/L", "Cloro_Residual_mg_L"),
                        val("PH", "pH"),
                        val("Alcalinidade"),
                        val("Dureza Total", "Dureza Cálcica"),
                        val("Temperatura"),
                        val("Aspecto Visual"),
                        val("Avaliação Técnica", "Observações", "Observacao"),
                        val("Local_Coleta", "Local de Coleta", "Ponto_Coleta"),
                        json.dumps(item, ensure_ascii=False),
                    ))

                with connect() as con:
                    con.execute("BEGIN IMMEDIATE")
                    con.execute("DELETE FROM clientes")
                    con.execute("DELETE FROM importacoes_medicoes")
                    con.execute("DELETE FROM medicoes")
                    con.executemany("""
                        INSERT INTO clientes (
                            id, cliente, cnpj, endereco, responsavel_tecnico,
                            representante_nome, representante_cpf
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, client_rows)
                    con.executemany("""
                        INSERT INTO medicoes (
                            id, cliente_id, data_coleta, lote_id, periodo_referencia, ano, mes,
                            cloro_livre, ph, alcalinidade, dureza_total, temperatura,
                            aspecto_visual, avaliacao_tecnica, local_coleta, dados_json
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, measurement_rows)
                    import_rows = []
                    for item in imports:
                        if not isinstance(item, dict):
                            continue
                        import_rows.append((
                            str(item.get("id") or uuid.uuid4()),
                            str(item.get("nome_arquivo") or ""),
                            str(item.get("periodo_referencia") or ""),
                            int(item.get("quantidade") or 0),
                            str(item.get("arquivo_hash") or ""),
                        ))
                    con.executemany("""
                        INSERT INTO importacoes_medicoes (id, nome_arquivo, periodo_referencia, quantidade, arquivo_hash)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            nome_arquivo = excluded.nome_arquivo,
                            periodo_referencia = excluded.periodo_referencia,
                            quantidade = excluded.quantidade,
                            arquivo_hash = excluded.arquivo_hash
                    """, import_rows)
                return self.send_json(200, {
                    "ok": True,
                    "clientCount": len(client_rows),
                    "measurementCount": len(measurement_rows),
                })
            except json.JSONDecodeError:
                return self.send_json(400, {"error": "JSON de backup inválido."})
            except Exception as exc:
                print(f"[AcquaTEC] Erro ao restaurar backup: {exc}")
                return self.send_json(500, {"error": "Não foi possível restaurar o backup completo."})

        if urlparse(self.path).path != "/api/measurements":
            return self.send_json(404, {"error": "Rota não encontrada."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 5_000_000:
                return self.send_json(413, {"error": "Arquivo de medições excede o limite permitido."})
            data = json.loads(self.rfile.read(length) or "{}")
            rows = data.get("rows") if isinstance(data, dict) else None
            nome_arquivo = str(data.get("filename") or "").strip()
            periodo_informado = str(data.get("period") or "").strip()
            if not isinstance(rows, list):
                return self.send_json(400, {"error": "O conteúdo deve conter uma lista de medições."})

            file_hash = str(data.get("file_hash") or "").strip()
            if not file_hash:
                canonical = json.dumps(
                    {"filename": nome_arquivo, "period": periodo_informado, "rows": rows},
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                file_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

            with connect() as con:
                existing = con.execute(
                    "SELECT id, nome_arquivo, quantidade, importado_em FROM importacoes_medicoes WHERE arquivo_hash = ?",
                    (file_hash,),
                ).fetchone()
            if existing:
                return self.send_json(409, {
                    "error": "Este arquivo já foi importado anteriormente.",
                    "existing": dict(existing),
                })

            clean = []
            lote_id = str(data.get("lot_id") or uuid.uuid4())
            period_values = set()
            for item in rows:
                if not isinstance(item, dict):
                    continue
                measurement_id = str(item.get("id") or "").strip()
                cliente_id = str(item.get("cliente_id") or "").strip()
                row = item.get("row") if isinstance(item.get("row"), dict) else {}
                if not measurement_id or not cliente_id:
                    continue

                def val(*keys):
                    for key in keys:
                        for found in row:
                            if str(found).strip().lower() == key.lower():
                                return str(row[found] or "").strip()
                    return ""

                data_coleta = val("Carimbo de data/hora", "Data/Hora", "Data", "Data_Coleta")
                year = ""
                month = ""
                match = re.match(r"^(\d{4})-(\d{1,2})", data_coleta)
                if not match:
                    match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})", data_coleta)
                    if match:
                        year = match.group(3)
                        month = match.group(2)
                else:
                    year = match.group(1)
                    month = match.group(2)
                if not year and periodo_informado:
                    match = re.match(r"^(\d{4})-(\d{1,2})", periodo_informado)
                    if match:
                        year = match.group(1)
                        month = match.group(2)
                periodo = f"{year}-{month.zfill(2)}" if year and month else periodo_informado
                if periodo:
                    period_values.add(periodo)

                clean.append((
                    measurement_id,
                    cliente_id,
                    data_coleta,
                    lote_id,
                    periodo,
                    int(year) if year.isdigit() else None,
                    int(month) if month.isdigit() else None,
                    val("Cloro Livre", "Cloro Livre mg/L", "Cloro_Residual_mg_L"),
                    val("PH", "pH"),
                    val("Alcalinidade"),
                    val("Dureza Total", "Dureza Cálcica"),
                    val("Temperatura"),
                    val("Aspecto Visual"),
                    val("Avaliação Técnica", "Observações", "Observacao"),
                    val("Local_Coleta", "Local de Coleta", "Ponto_Coleta"),
                    json.dumps(row, ensure_ascii=False)
                ))

            if not clean:
                return self.send_json(400, {"error": "Nenhuma medição possui vínculo válido com um cliente."})

            with connect() as con:
                con.execute("BEGIN IMMEDIATE")
                con.executemany("""
                    INSERT INTO medicoes (
                        id, cliente_id, data_coleta, lote_id, periodo_referencia, ano, mes,
                        cloro_livre, ph, alcalinidade, dureza_total, temperatura,
                        aspecto_visual, avaliacao_tecnica, local_coleta, dados_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO NOTHING
                """, clean)
                periodo_importacao = sorted(period_values)[-1] if period_values else periodo_informado
                con.execute("""
                    INSERT INTO importacoes_medicoes (id, nome_arquivo, periodo_referencia, quantidade, arquivo_hash)
                    VALUES (?, ?, ?, ?, ?)
                """, (lote_id, nome_arquivo, periodo_importacao, len(clean), file_hash))
            return self.send_json(200, {"ok": True, "count": len(clean)})
        except json.JSONDecodeError:
            return self.send_json(400, {"error": "JSON inválido."})
        except Exception as exc:
            print(f"[AcquaTEC] Erro ao salvar medições: {exc}")
            return self.send_json(500, {"error": "Não foi possível salvar as medições no banco SQLite."})

    def do_PUT(self):
        if urlparse(self.path).path != "/api/clients":
            return self.send_json(404, {"error": "Rota não encontrada."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 2_000_000:
                return self.send_json(413, {"error": "Arquivo de clientes excede o limite permitido."})
            data = json.loads(self.rfile.read(length) or b"[]")
            if not isinstance(data, list):
                return self.send_json(400, {"error": "O conteúdo deve ser uma lista de clientes."})
            clean = []
            for item in data:
                if not isinstance(item, dict) or not str(item.get("Cliente", "")).strip():
                    continue
                clean.append((
                    str(item.get("id") or ""),
                    str(item.get("Cliente", "")).strip(),
                    str(item.get("CNPJ", "")).strip(),
                    str(item.get("Endereco", "")).strip(),
                    str(item.get("Responsavel_Tecnico", "")).strip(),
                    str(item.get("Representante_Nome", "")).strip(),
                    str(item.get("Representante_CPF", "")).strip(),
                ))
            if any(not row[0] for row in clean):
                return self.send_json(400, {"error": "Um ou mais clientes estão sem identificador."})
            with connect() as con:
                con.execute("BEGIN IMMEDIATE")
                con.executemany("""
                    INSERT INTO clientes (
                        id, cliente, cnpj, endereco, responsavel_tecnico,
                        representante_nome, representante_cpf, atualizado_em
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(id) DO UPDATE SET
                        cliente = excluded.cliente,
                        cnpj = excluded.cnpj,
                        endereco = excluded.endereco,
                        responsavel_tecnico = excluded.responsavel_tecnico,
                        representante_nome = excluded.representante_nome,
                        representante_cpf = excluded.representante_cpf,
                        atualizado_em = CURRENT_TIMESTAMP
                """, clean)
                client_ids = [row[0] for row in clean]
                if client_ids:
                    placeholders = ",".join("?" for _ in client_ids)
                    con.execute(f"DELETE FROM clientes WHERE id NOT IN ({placeholders})", client_ids)
                else:
                    con.execute("DELETE FROM clientes")
            return self.send_json(200, {"ok": True, "count": len(clean)})
        except json.JSONDecodeError:
            return self.send_json(400, {"error": "JSON inválido."})
        except Exception as exc:
            print(f"[AcquaTEC] Erro ao salvar clientes: {exc}")
            return self.send_json(500, {"error": "Não foi possível salvar os clientes no banco SQLite."})

    def log_message(self, fmt, *args):
        print("[AcquaTEC] " + (fmt % args))

if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer(("127.0.0.1", 8765), AcquaHandler)
    print("AcquaTEC disponível em http://127.0.0.1:8765")
    print("Banco SQLite:", ROOT / "dados" / "acquatec.db")
    threading.Timer(0.8, lambda: webbrowser.open("http://127.0.0.1:8765")).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
