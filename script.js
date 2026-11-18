
const LEGACY_KEY = 'acquatec_clientes_v1';
let clients = [], measurements = [], mapping = [], generated = 0, measurementsPendingSave = false;
async function saveClients() {
    const response = await fetch('/api/clients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clients) });
    if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || 'Não foi possível salvar os clientes no banco SQLite.'); }
    updateMetrics(); renderClients();
}
async function initializeApp() {
    try {
        const response = await fetch('/api/clients');
        if (!response.ok) throw new Error('Servidor local indisponível.');
        clients = await response.json();
        // Migração única: importa os clientes antigos do localStorage somente se o SQLite estiver vazio.
        if (clients.length === 0) {
            let legacy = [];
            try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'); } catch { }
            if (Array.isArray(legacy) && legacy.length) {
                clients = legacy;
                await saveClients();
            }
        }
        await loadPersistedMeasurements(false);
        updateMetrics();
        renderClients();
    } catch (error) {
        msg('clientStatus', 'Não foi possível conectar ao banco local. Inicie o servidor pelo iniciar_linux.sh ou iniciar_windows.bat. ' + error.message, 'err');
        document.getElementById('clientsBody').innerHTML = '<tr><td colspan="6" class="empty">Banco de dados indisponível. Inicie o servidor local.</td></tr>';
    }
}


function updateMetrics() {
    document.getElementById('mClientes').textContent = clients.length;
    document.getElementById('mMedicoes').textContent = measurements.length; document.getElementById('mLaudos').textContent = generated
}
function go(p) {
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    document.getElementById('page-' + p).classList.add('active'); document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('active', x.dataset.page === p));
    document.getElementById('breadcrumb').textContent = ({ inicio: 'Visão geral', clientes: 'Clientes', laudos: 'Gerador de laudos', contratos: 'Contratos', dados: 'Dados e backup' })[p]
}
document.querySelectorAll('.nav button').forEach(b => b.onclick = () => go(b.dataset.page));
document.getElementById('clock').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
function msg(id, text, type = 'ok') { let e = document.getElementById(id); e.className = 'statusbox ' + type; e.textContent = text }
function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() }
function parseCSV(text) {
    let rows = [], row = [], field = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        let c = text[i], n = text[i + 1];
        if (c === '"' && quoted && n === '"') { field += '"'; i++ } else if (c === '"') { quoted = !quoted } else if ((c === ',' || c === ';' || c === '\t') && !quoted) { row.push(field.trim()); field = '' }
        else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && n === '\n') i++; row.push(field.trim()); if (row.some(x => x !== '')) rows.push(row); row = []; field = '' } else field += c
    }
    row.push(field.trim()); if (row.some(x => x !== '')) rows.push(row); if (!rows.length) return [];
    const headers = rows.shift().map(x => x.trim());
    return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}
function val(o, ...keys) { for (let k of keys) { let found = Object.keys(o || {}).find(x => norm(x) === norm(k)); if (found !== undefined) return o[found] } return '' }
function fromRow(r) { return { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), Cliente: val(r, 'Nome', 'Razao Social', 'Razão Social', 'Cliente'), CNPJ: val(r, 'CNPJ'), Endereco: val(r, 'Endereco', 'Endereço'), Responsavel_Tecnico: val(r, 'Responsavel_Tecnico', 'Responsável Técnico'), Representante_Nome: val(r, 'Representante_Nome', 'Representante', 'Representante Legal'), Representante_CPF: val(r, 'Representante_CPF', 'CPF Representante', 'CPF') } }
document.getElementById('clientForm').onsubmit = async e => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const c = {
        id: id || String(Date.now()),
        Cliente: cCliente.value.trim(),
        CNPJ: cCNPJ.value.trim(),
        Endereco: cEndereco.value.trim(),
        Responsavel_Tecnico: cRT.value.trim(),
        Representante_Nome: cRepresentante.value.trim(),
        Representante_CPF: cRepresentanteCPF.value.trim()
    };
    const previous = [...clients];
    const i = clients.findIndex(x => x.id === id);
    if (i >= 0) clients[i] = c;
    else clients.push(c);

    try {
        await saveClients();
        resetClient();
        msg('clientStatus', 'Cliente salvo com sucesso no SQLite.');
    } catch (err) {
        clients = previous;
        updateMetrics();
        renderClients();
        msg('clientStatus', err.message, 'err');
    }
};
function resetClient() { document.getElementById('clientForm').reset(); document.getElementById('editId').value = ''; document.getElementById('formTitle').textContent = 'Cadastrar cliente' }
function renderClients() { let q = norm(document.getElementById('filterClients').value), list = clients.filter(c => norm(c.Cliente).includes(q) || norm(c.Endereco).includes(q)); document.getElementById('clientCount').textContent = clients.length + ' registros'; let b = document.getElementById('clientsBody'); b.innerHTML = ''; if (!list.length) { b.innerHTML = '<tr><td colspan="6" class="empty">Nenhum cliente encontrado.</td></tr>'; if (typeof renderContractClients === 'function') renderContractClients(); return } list.forEach(c => { let tr = document.createElement('tr'); tr.innerHTML = `<td><b>${esc(c.Cliente)}</b></td><td>${esc(c.CNPJ || '—')}</td><td>${esc(c.Endereco || '—')}</td><td>${esc(c.Responsavel_Tecnico || '—')}</td><td>${esc(c.Representante_Nome || '—')}<br><span class="muted">${esc(c.Representante_CPF || 'CPF não informado')}</span></td><td><button class="btn" onclick="editClient('${c.id}')">Editar</button> <button class="btn danger" onclick="deleteClient('${c.id}')">Excluir</button></td>`; b.appendChild(tr) }); if (typeof renderContractClients === 'function') renderContractClients() }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
function editClient(id) { let c = clients.find(x => x.id === id); if (!c) return; editId.value = c.id; cCliente.value = c.Cliente; cCNPJ.value = c.CNPJ || ''; cEndereco.value = c.Endereco; cRT.value = c.Responsavel_Tecnico; cRepresentante.value = c.Representante_Nome || ''; cRepresentanteCPF.value = c.Representante_CPF || ''; formTitle.textContent = 'Editar cliente'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function deleteClient(id) { if (confirm('Excluir este cliente do cadastro local?')) { const previous = [...clients]; clients = clients.filter(x => x.id !== id); try { await saveClients(); msg('clientStatus', 'Cliente excluído.') } catch (err) { clients = previous; msg('clientStatus', err.message, 'err') } } }
document.getElementById('clientCsv').onchange = async e => { let f = e.target.files[0]; if (!f) return; try { let rows = parseCSV(await f.text()); let imported = rows.map(fromRow).filter(x => x.Cliente); for (let c of imported) { let old = clients.find(x => norm(x.Cliente) === norm(c.Cliente)); if (old) Object.assign(old, c, { id: old.id, Representante_Nome: c.Representante_Nome || old.Representante_Nome || '', Representante_CPF: c.Representante_CPF || old.Representante_CPF || '' }); else clients.push(c) } await saveClients(); msg('clientStatus', imported.length + ' clientes importados/atualizados.') } catch (err) { msg('clientStatus', 'Erro ao ler CSV: ' + err.message, 'err') } e.target.value = '' };
async function loadPersistedMeasurements(showMessage = true) {
    try {
        const response = await fetch('/api/measurements');
        if (!response.ok) throw new Error('Não foi possível carregar as medições persistidas.');
        const persisted = await response.json();
        measurements = persisted;
        mapping = measurements.map(row => row._cliente_id || bestMatch(val(row, 'Cliente')));
        measurementsPendingSave = false;
        updateSaveMeasurementsButton();
        updateMetrics();
        if (showMessage && persisted.length) {
            buildMapping();
            document.getElementById('mappingPanel').style.display = 'block';
            document.getElementById('rowsCount').textContent = persisted.length + ' linhas';
            msg('importStatus', persisted.length + ' medições carregadas do SQLite.');
        } else if (showMessage) {
            msg('importStatus', 'Ainda não há medições salvas no SQLite.', 'err');
        }
    } catch (err) {
        msg('importStatus', err.message, 'err');
    }
}
document.getElementById('loadPersisted').onclick = () => loadPersistedMeasurements(true);
document.getElementById('prepare').onclick = async () => {
    let mf = document.getElementById('medicoesFile').files[0];
    measurementsPendingSave = false;
    updateSaveMeasurementsButton();
    try {
        if (!clients.length) throw Error('Cadastre os clientes antes de continuar.');
        if (!mf) throw Error('Selecione o CSV das medições semanais.');
        measurements = parseCSV(await mf.text()); if (!measurements.length) throw Error('O arquivo de medições está vazio ou não foi reconhecido.');
        const periodInput = document.getElementById('measurementPeriod');
        if (!periodInput.value) {
            const rawDate = val(measurements[0], 'Carimbo de data/hora', 'Data/Hora', 'Data', 'Data_Coleta');
            const match = rawDate.match(/^(\d{4})-(\d{2})/);
            if (match) periodInput.value = match[1] + '-' + match[2];
        }
        buildMapping(); measurementsPendingSave = true; updateSaveMeasurementsButton(); msg('importStatus', `${measurements.length} medições carregadas. Confira os vínculos abaixo.`); document.getElementById('mappingPanel').style.display = 'block'; document.getElementById('rowsCount').textContent = measurements.length + ' linhas'; updateMetrics();
    } catch (err) { msg('importStatus', err.message, 'err') }
};
function updateSaveMeasurementsButton() {
    const button = document.getElementById('saveMeasurements');
    button.disabled = !measurementsPendingSave || !measurements.length || mapping.some(id => !id);
}
async function saveMeasurements() {
    if (!measurementsPendingSave) throw Error('Importe um novo CSV antes de salvar as medições.');
    if (!measurements.length) throw Error('Não há medições para salvar.');
    if (mapping.some(id => !id)) throw Error('Há linhas sem cliente vinculado.');
    const period = document.getElementById('measurementPeriod').value;
    const rows = measurements.map((row, index) => ({
        id: row._measurement_id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + index)),
        cliente_id: mapping[index],
        row
    }));
    const csvFile = document.getElementById('medicoesFile').files[0];
    const fileHash = csvFile ? await hashText(await csvFile.text()) : '';
    const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            rows,
            period,
            filename: csvFile ? csvFile.name : '',
            lot_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            file_hash: fileHash
        })
    });
    const detail = await response.json().catch(() => null);
    if (!response.ok) {
        const message = detail && detail.error
            ? detail.error
            : `O servidor recusou a gravação (HTTP ${response.status}). Encerre e reinicie o servidor local.`;
        throw new Error(message);
    }
    measurementsPendingSave = false;
    updateSaveMeasurementsButton();
    await loadPersistedMeasurements(false);
    return detail.count;
}
document.getElementById('saveMeasurements').onclick = async () => {
    try {
        const count = await saveMeasurements();
        msg('importStatus', count + ' medições salvas no SQLite.');
    } catch (err) {
        msg('importStatus', err.message, 'err');
    }
};
function bestMatch(name) { let n = norm(name); let exact = clients.find(c => norm(c.Cliente) === n); if (exact) return exact.id; let partial = clients.find(c => n && (n.includes(norm(c.Cliente)) || norm(c.Cliente).includes(n))); return partial ? partial.id : '' }
function buildMapping() { mapping = measurements.map(r => bestMatch(val(r, 'Cliente'))); let body = document.getElementById('mappingBody'); body.innerHTML = ''; measurements.forEach((r, i) => { let tr = document.createElement('tr'), opts = '<option value="">— Selecione o cliente —</option>' + clients.map(c => `<option value="${esc(c.id)}" ${mapping[i] === c.id ? 'selected' : ''}>${esc(c.Cliente)}${c.Endereco ? ' · ' + esc(c.Endereco) : ''}</option>`).join(''); tr.innerHTML = `<td>${i + 1}</td><td><b>${esc(val(r, 'Cliente') || 'Não informado')}</b></td><td><select data-index="${i}">${opts}</select></td>`; body.appendChild(tr) }); body.querySelectorAll('select').forEach(s => s.onchange = () => { mapping[Number(s.dataset.index)] = s.value; updateSaveMeasurementsButton(); }); updateSaveMeasurementsButton() }
function parseNum(v) { return parseFloat(String(v ?? '').replace(',', '.')) }
function diagnose(v, min, max) { let n = parseNum(v); if (!String(v ?? '').trim() || Number.isNaN(n)) return 'Não informado'; return n >= min && n <= max ? 'Conforme' : 'Fora do Padrão' }
function dateInfo(row) { let raw = val(row, 'Carimbo de data/hora', 'Data/Hora', 'Data'); let d = new Date(); if (raw) { let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/); if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)); else { let p = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (p) d = new Date(+p[3], +p[2] - 1, +p[1]) } } let next = new Date(d); next.setDate(next.getDate() + 7); let fmt = x => x.toLocaleDateString('pt-BR'); return { date: fmt(d), time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h'), next: fmt(next) } }
document.getElementById('generate').onclick = async () => {
    let status = document.getElementById('generateStatus');
    try {
        if (!window.jspdf || !window.JSZip) throw Error('As bibliotecas de PDF/ZIP não carregaram. Verifique a conexão com a internet e recarregue a página.');
        if (!measurements.length) throw Error('Importe as medições antes de gerar.');
        if (mapping.some(x => !x)) throw Error('Há linhas sem cliente vinculado. Confira todas as associações.');
        if (!confirm(`Gerar ${measurements.length} laudo(s) em PDF e baixar um pacote ZIP?`)) return;
        msg('generateStatus', 'Gerando documentos. Aguarde...');
        const { jsPDF } = window.jspdf, zip = new JSZip();
        const logoBase64 = await obterLogoBase64();
        measurements.forEach((row, index) => {
            let client = clients.find(c => c.id === mapping[index]) || {}, d = dateInfo(row);
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' }); doc.setFont('helvetica', 'normal');
            doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 131, 163); doc.addImage(logoBase64, 'PNG', 146, 6, 55, 36); doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 131, 163);

            doc.text('RELATÓRIO E MONITORAMENTO', 105, 19, { align: 'center' });
            doc.text('CONTROLE DE QUALIDADE', 105, 26, { align: 'center' });;
            doc.setFontSize(10); doc.setTextColor(51, 51, 51);
            const line = (label, value, y, lx = 15, vx = 45) => { doc.setFont('helvetica', 'bold'); doc.text(label, lx, y); doc.setFont('helvetica', 'normal'); doc.text(String(value || 'Não informado'), vx, y, { maxWidth: 155 }) };
            line('Cliente:', client.Cliente, 34, 15, 30); line('Endereço:', client.Endereco, 40, 15, 34); line('CNPJ:', client.CNPJ, 46, 15, 27); line('Local da Coleta:', val(row, 'Local_Coleta', 'Local de Coleta') || 'Piscina Adulto', 52, 15, 44); line('Data / Hora:', d.date + ' às ' + d.time, 58, 15, 37); line('Responsável Técnico:', client.Responsavel_Tecnico || 'Não informado', 64, 15, 53);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 131, 163); doc.text('RESULTADOS DA ANÁLISE', 15, 82);
            doc.setFillColor(0, 131, 163); doc.rect(15, 86, 185, 8, 'F'); doc.setTextColor(255, 255, 255); doc.text('Parâmetro', 18, 91.5); doc.text('Resultados', 70, 91.5); doc.text('Valor de Referência', 115, 91.5); doc.text('Diagnóstico', 165, 91.5);
            const chlorine = val(row, 'Cloro Livre'), ph = val(row, 'PH', 'pH'), alk = val(row, 'Alcalinidade'), hard = val(row, 'Dureza Total', 'Dureza Cálcica'), temp = val(row, 'Temperatura'), visual = val(row, 'Aspecto Visual');
            const params = [{ n: 'Cloro Livre', v: chlorine, ref: '1.0 – 3.0', diag: diagnose(chlorine, 1, 3) }, { n: 'PH', v: ph, ref: '7.4 – 7.8', diag: diagnose(ph, 7.4, 7.8) }, { n: 'Alcalinidade', v: alk, ref: '80 - 120', diag: diagnose(alk, 80, 120) }, { n: 'Dureza Cálcica', v: hard, ref: '200 - 400', diag: diagnose(hard, 200, 400) }, { n: 'Temperatura', v: temp, ref: '26 - 32', diag: temp ? diagnose(temp, 26, 32) : 'Não informado' }, { n: 'Aspecto Visual', v: visual, ref: 'límpida', diag: visual ? (norm(visual).includes('limp') ? 'Conforme' : 'Verificar') : 'Não informado' }];
            let y = 94; doc.setFont('helvetica', 'normal'); params.forEach(p => { doc.setTextColor(51, 51, 51); doc.text(p.n, 18, y + 5); doc.text(String(p.v || 'Não informado'), 70, y + 5); doc.text(p.ref, 115, y + 5); doc.setFontSize(8.5); doc.text(p.diag, 165, y + 5); doc.setFontSize(10); doc.setDrawColor(224, 224, 224); doc.line(15, y + 8, 200, y + 8); y += 8 });
            y += 13; doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 131, 163); doc.text('AVALIAÇÃO TÉCNICA', 15, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 51, 51);
            let note = val(row, 'Avaliação Técnica', 'Observações', 'Observacao'); let allOk = params.every(p => p.diag === 'Conforme'); let defaultText = allOk ? 'A água analisada apresentou parâmetros dentro das faixas recomendadas para utilização recreativa, não sendo observadas irregularidades que comprometam a segurança ou o conforto dos usuários.' : '. Foram identificados parâmetros que requerem avaliação. Consulte os resultados apresentados e registre as medidas corretivas pertinentes.';
            let split = doc.splitTextToSize((note ? note + ' ' : '') + (defaultText), 185); doc.text(split, 15, y); y += split.length * 5 + 7;
            doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 131, 163); doc.text('STATUS DA ÁGUA', 15, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setTextColor(51, 51, 51); doc.text(allOk ? 'Piscina dentro dos padrões avaliados.' : 'Existem parâmetros não conformes ou não informados. Avaliação complementar necessária.', 15, y, { maxWidth: 185 }); y += 9;
            doc.setFont('helvetica', 'bold'); doc.text('Data da próxima análise: ' + d.next, 15, y);
            doc.setFontSize(10); doc.setTextColor(0, 131, 163); doc.text('________________ Acqua TEC Análises ________________', 108, 245, { align: 'center' });
            let safe = (client.Cliente || 'Cliente_' + (index + 1)).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
            zip.file(`Laudo_${safe}.pdf`, doc.output('arraybuffer'));
        });
        const blob = await zip.generateAsync({ type: 'blob' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'Pacote_Laudos_Acqua_TEC.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
        generated += measurements.length; updateMetrics();
        let hist = JSON.parse(localStorage.getItem('acquatec_history') || '[]');
        hist.unshift({ date: new Date().toLocaleString('pt-BR'), count: measurements.length });
        localStorage.setItem('acquatec_history', JSON.stringify(hist));
        renderHistory(); msg('generateStatus', 'Pacote ZIP gerado e baixado com ' + measurements.length + ' laudo(s).');
    } catch (e) { msg('generateStatus', e.message, 'err') }
};
function renderHistory() {
    let h = JSON.parse(localStorage.getItem('acquatec_history') || '[]'); document.getElementById('history').innerHTML = h.length ? h.map(x => `<div style="padding:9px 0;border-bottom:1px solid #edf1f1;font-size:12px"><b>${x.count} laudo(s)</b> <span class="muted">· ${x.date}</span></div>`).join('') : 'Nenhum pacote gerado nesta sessão.'
}

function csvCell(value) { let s = String(value ?? ''); return '"' + s.replace(/"/g, '""') + '"' }
async function hashText(text) {
    if (window.crypto && window.crypto.subtle) {
        const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
}
function downloadClientCSV() {
    const headers = ['Nome', 'CNPJ', 'Endereco', 'Responsavel_Tecnico', 'Representante_Nome', 'Representante_CPF'];
    const lines = [
        headers.join(';'),
        ...clients.map(c => [
            csvCell(c.Cliente || ''),
            csvCell(c.CNPJ || ''),
            csvCell(c.Endereco || ''),
            csvCell(c.Responsavel_Tecnico || ''),
            csvCell(c.Representante_Nome || ''),
            csvCell(c.Representante_CPF || '')
        ].join(';'))
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'clientes_acquatec.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function obterLogoBase64() {
    const img = document.getElementById('logoAcquaTec');

    if (!img) {
        throw new Error('Elemento da logo não encontrado.');
    }

    if (!img.complete || !img.naturalWidth) {
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(
                new Error('Não foi possível carregar a logo.')
            );
        });
    }

    // Verifica se a imagem está acessível na mesma origem
    const origemImagem = new URL(img.src).origin;

    if (origemImagem !== window.location.origin) {
        throw new Error(
            'A logo está em outro domínio. Utilize uma imagem local na pasta do sistema.'
        );
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Não foi possível criar o Canvas.');
    }

    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL('image/png');


} document.getElementById('clientCsvList').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
        const rows = parseCSV(await f.text()), imported = rows.map(fromRow).filter(c => c.Cliente);
        for (const c of imported) { const old = clients.find(x => norm(x.Cliente) === norm(c.Cliente)); if (old) Object.assign(old, c, { id: old.id, Representante_Nome: c.Representante_Nome || old.Representante_Nome || '', Representante_CPF: c.Representante_CPF || old.Representante_CPF || '' }); else clients.push(c) }
        await saveClients(); msg('clientStatus', imported.length + ' clientes importados/atualizados a partir do CSV.');
    } catch (err) { msg('clientStatus', 'Erro ao importar CSV: ' + err.message, 'err') }
    e.target.value = '';
};
async function exportBackup() {
    try {
        msg('backupStatus', 'Preparando backup completo...');
        const [clientsResponse, measurementsResponse, importsResponse] = await Promise.all([
            fetch('/api/clients'),
            fetch('/api/measurements'),
            fetch('/api/measurement-imports')
        ]);
        if (!clientsResponse.ok || !measurementsResponse.ok || !importsResponse.ok) {
            throw new Error('Não foi possível carregar todos os dados para o backup.');
        }
        const [currentClients, currentMeasurements, currentImports] = await Promise.all([
            clientsResponse.json(),
            measurementsResponse.json(),
            importsResponse.json()
        ]);
        const backup = {
            app: 'Acqua TEC',
            version: 2,
            exportedAt: new Date().toISOString(),
            clients: currentClients,
            measurements: currentMeasurements,
            measurement_imports: currentImports
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'backup_acquatec_completo.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        msg('backupStatus', `Backup completo exportado: ${currentClients.length} clientes e ${currentMeasurements.length} medições.`);
    } catch (err) {
        msg('backupStatus', err.message, 'err');
    }
}
document.getElementById('restoreFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
        const data = JSON.parse(await f.text());
        if (data.app !== 'Acqua TEC' || !Array.isArray(data.clients) ||
            !Array.isArray(data.measurements) || !Array.isArray(data.measurement_imports)) {
            throw Error('Arquivo de backup inválido ou incompleto.');
        }
        if (!confirm(`Restaurar o backup completo? Isso substituirá ${data.clients.length} clientes e ${data.measurements.length} medições atuais.`)) return;
        const response = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const detail = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(detail.error || 'Não foi possível restaurar o backup.');
        await initializeApp();
        msg('backupStatus', `Backup restaurado: ${detail.clientCount} clientes e ${detail.measurementCount} medições.`);
    } catch (err) {
        msg('backupStatus', err.message, 'err');
    } finally {
        e.target.value = '';
    }
};
initializeApp();
