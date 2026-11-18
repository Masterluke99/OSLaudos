const contractClient = document.getElementById('contractClient');
const contractDateFields = {
    start: document.getElementById('contractStart'),
    end: document.getElementById('contractEnd'),
    signing: document.getElementById('contractSigningDate')
};

function renderContractClients() {
    const selected = contractClient.value;
    contractClient.replaceChildren(new Option('Selecione um cliente cadastrado', ''));
    clients.forEach(client => {
        contractClient.add(new Option(client.Cliente, client.id));
    });
    contractClient.value = clients.some(client => client.id === selected) ? selected : '';
    updateContractSignatory();
}

function updateContractSignatory() {
    const client = clients.find(item => item.id === contractClient.value);
    document.getElementById('contractRepresentative').value = client ? client.Representante_Nome || '' : '';
    document.getElementById('contractRepresentativeCPF').value = client ? client.Representante_CPF || '' : '';
}

function dateToISO(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

function parseISODate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function addMonths(date, months) {
    const result = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + months + 1, 0).getDate();
    result.setMonth(result.getMonth() + months, Math.min(date.getDate(), lastDay));
    return result;
}

function formatContractDate(value) {
    return parseISODate(value).toLocaleDateString('pt-BR');
}

function formatLongDate(value) {
    return parseISODate(value).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function formatBRL(value) {
    return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safeFilename(value) {
    return String(value || 'Cliente')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'Cliente';
}

function createContractData() {
    const client = clients.find(item => item.id === contractClient.value);
    if (!client) throw new Error('Selecione um cliente cadastrado.');
    if (!client.Representante_Nome || !client.Representante_CPF) {
        throw new Error('Cadastre o representante legal e o CPF do cliente na página Clientes.');
    }
    if (client.Representante_CPF.replace(/\D/g, '').length !== 11) {
        throw new Error('O CPF do representante deve conter 11 dígitos. Corrija-o no cadastro do cliente.');
    }

    const start = contractDateFields.start.value;
    const end = contractDateFields.end.value;
    const signingDate = contractDateFields.signing.value;
    const duration = Number(document.getElementById('contractDuration').value);
    const total = Math.round(Number(document.getElementById('contractTotal').value) * 100);
    const installments = Number(document.getElementById('contractInstallments').value);
    const dueDay = Number(document.getElementById('contractDueDay').value);
    const payment = document.getElementById('contractPayment').value.trim();
    const registration = document.getElementById('contractRegistration').value.trim();

    if (!start || !end || !signingDate || parseISODate(end) <= parseISODate(start)) {
        throw new Error('Informe um período de vigência válido, com término posterior ao início.');
    }
    if (!Number.isInteger(duration) || duration < 1 ||
        !Number.isInteger(installments) || installments < 1 ||
        !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error('Confira a vigência, o número de parcelas e o dia de vencimento.');
    }
    if (!Number.isInteger(total) || total < installments) {
        throw new Error('Informe um valor global válido e maior que zero.');
    }
    if (total % installments !== 0) {
        throw new Error('O valor global deve ser divisível igualmente pelo número de parcelas.');
    }
    if (!payment || !registration) throw new Error('Informe a forma de pagamento e o registro profissional.');

    return {
        client,
        start,
        end,
        signingDate,
        duration,
        total: total / 100,
        installments,
        installmentValue: total / installments / 100,
        dueDay,
        payment,
        registration
    };
}

function buildContractPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const left = 18;
    const right = 18;
    const textWidth = pageWidth - left - right;
    const bottom = 278;
    let y = 33;

    function pageHeader() {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(0, 95, 119);
        doc.text('ACQUA TEC ANÁLISES', pageWidth / 2, 13, { align: 'center' });
        doc.setFontSize(9);
        doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE RESPONSABILIDADE TÉCNICA', pageWidth / 2, 19, {
            align: 'center',
            maxWidth: textWidth
        });
        doc.setDrawColor(0, 131, 163);
        doc.line(left, 24, pageWidth - right, 24);
        doc.setTextColor(37, 52, 56);
        y = 32;
    }

    function nextPage() {
        doc.addPage();
        pageHeader();
    }

    function addParagraph(text, options = {}) {
        const fontSize = options.fontSize || 10;
        const lineHeight = options.lineHeight || 5;
        const indent = options.indent || 0;
        doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(options.color ? options.color[0] : 37,
            options.color ? options.color[1] : 52,
            options.color ? options.color[2] : 56);
        const lines = doc.splitTextToSize(text, textWidth - indent);
        for (const line of lines) {
            if (y + lineHeight > bottom) nextPage();
            doc.text(line, left + indent, y);
            y += lineHeight;
        }
        y += options.after === undefined ? 2 : options.after;
    }

    function addClause(title, paragraphs) {
        if (y > bottom - 13) nextPage();
        addParagraph(title, { bold: true, fontSize: 10, lineHeight: 5.5, after: 2, color: [0, 95, 119] });
        paragraphs.forEach(paragraph => addParagraph(paragraph));
    }

    pageHeader();
    addParagraph('CONTRATANTE:', { bold: true, after: 0 });
    addParagraph(`${data.client.Cliente}, CNPJ nº ${data.client.CNPJ || 'não informado'}, com endereço à ${data.client.Endereco || 'não informado'}, neste ato representado por ${data.client.Representante_Nome}, CPF nº ${data.client.Representante_CPF}.`, { after: 4 });
    addParagraph('CONTRATADO:', { bold: true, after: 0 });
    addParagraph(`ANTONIO LUCAS TRIBURTINO, profissional Técnico em Química, registro profissional nº ${data.registration}, atuando através da ACQUA TEC ANÁLISES, doravante denominado CONTRATADO.`, { after: 5 });

    addClause('CLÁUSULA 1ª – DO OBJETO', [
        'O presente contrato tem por objeto a prestação de serviços de Responsabilidade Técnica relacionados ao acompanhamento técnico do tratamento químico e controle da qualidade da água da piscina mantida pelo CONTRATANTE.',
        'Integram o objeto deste contrato:',
        'I – acompanhamento técnico das condições relacionadas ao tratamento químico e à qualidade da água;',
        'II – orientação técnica quanto aos procedimentos e parâmetros relacionados ao tratamento da água;',
        'III – elaboração de relatórios mensais de atividades técnicas;',
        'IV – realização e/ou emissão de laudos de análises periódicas, de acordo com o planejamento técnico e conforme a necessidade identificada;',
        'V – acompanhamento dos registros e informações técnicas relacionadas ao tratamento e controle da qualidade da água;',
        'VI – emissão do TRT – Termo de Responsabilidade Técnica, formalizando o vínculo profissional e a Responsabilidade Técnica perante o Conselho Profissional competente, observadas as atribuições profissionais do CONTRATADO;',
        'VII – demais orientações técnicas diretamente relacionadas ao objeto da Responsabilidade Técnica contratada.',
        'Parágrafo único: O presente instrumento possui como objeto exclusivo a Responsabilidade Técnica, não abrangendo serviços operacionais de limpeza, manutenção, conservação ou execução rotineira do tratamento da piscina, os quais, caso existentes, constituem contratação distinta entre as partes.'
    ]);

    addClause('CLÁUSULA 2ª – DA RESPONSABILIDADE TÉCNICA', [
        'O CONTRATADO assumirá a Responsabilidade Técnica pelo objeto descrito neste instrumento, mediante a emissão e formalização do respectivo TRT – Termo de Responsabilidade Técnica, perante o Conselho Profissional competente.',
        'Parágrafo primeiro: A Responsabilidade Técnica compreenderá o acompanhamento, orientação e controle técnico das atividades relacionadas ao tratamento químico e à qualidade da água, dentro das atribuições profissionais conferidas ao CONTRATADO.',
        'Parágrafo segundo: O TRT será emitido para o período correspondente à vigência deste contrato, constituindo o instrumento de formalização do vínculo profissional e da Responsabilidade Técnica assumida.',
        'Parágrafo terceiro: A responsabilidade do CONTRATADO limita-se às atividades abrangidas pelo objeto deste contrato e às atribuições profissionais legalmente conferidas ao responsável técnico.'
    ]);

    addClause('CLÁUSULA 3ª – DOS RELATÓRIOS E LAUDOS', [
        'O CONTRATADO fornecerá ao CONTRATANTE relatório mensal de atividades, contendo o registro das atividades técnicas realizadas no período e as informações pertinentes ao acompanhamento da qualidade da água e do tratamento químico.',
        'Também poderão ser emitidos laudos de análises periódicos ou extraordinários, conforme planejamento técnico, necessidade identificada ou solicitação relacionada ao objeto deste contrato.',
        'Parágrafo único: Quando determinada análise depender de ensaio laboratorial específico, sua realização poderá ser encaminhada a laboratório devidamente habilitado, observadas as condições e custos previamente acordados entre as partes.'
    ]);

    addClause('CLÁUSULA 4ª – DAS OBRIGAÇÕES DO CONTRATADO', [
        'Constituem obrigações do CONTRATADO:',
        'I – exercer a Responsabilidade Técnica objeto deste contrato com zelo e diligência profissional;',
        'II – realizar o acompanhamento técnico previsto neste instrumento;',
        'III – elaborar os relatórios mensais de atividades;',
        'IV – emitir os laudos e documentos técnicos previstos neste contrato;',
        'V – orientar o CONTRATANTE quanto às medidas técnicas necessárias relacionadas ao objeto da Responsabilidade Técnica;',
        'VI – manter a documentação técnica pertinente ao serviço prestado;',
        'VII – comunicar ao CONTRATANTE eventuais situações tecnicamente relevantes que possam comprometer a qualidade da água ou a adequada execução dos procedimentos de tratamento.'
    ]);

    addClause('CLÁUSULA 5ª – DAS OBRIGAÇÕES DO CONTRATANTE', [
        'Constituem obrigações do CONTRATANTE:',
        'I – fornecer acesso às instalações e às informações necessárias ao exercício da Responsabilidade Técnica;',
        'II – disponibilizar ao CONTRATADO as informações relacionadas ao tratamento e à qualidade da água que sejam necessárias ao acompanhamento técnico;',
        'III – permitir a realização das avaliações, análises e acompanhamentos previstos neste contrato;',
        'IV – cumprir as orientações técnicas formalmente apresentadas pelo CONTRATADO relacionadas ao objeto deste contrato;',
        'V – efetuar os pagamentos na forma e nos prazos estabelecidos neste instrumento;',
        'VI – comunicar previamente ao CONTRATADO qualquer alteração relevante nas condições de funcionamento, utilização ou tratamento da piscina.'
    ]);

    addClause('CLÁUSULA 6ª – DO VALOR E DA FORMA DE PAGAMENTO', [
        `Pelos serviços objeto deste contrato, o CONTRATANTE pagará ao CONTRATADO o valor global de R$ ${formatBRL(data.total)}, correspondente ao período de ${data.duration} meses de vigência contratual. O valor global será pago em ${data.installments} parcelas mensais de R$ ${formatBRL(data.installmentValue)} cada.`,
        `Parágrafo primeiro: O pagamento será realizado até o dia ${data.dueDay} de cada mês, através de ${data.payment}.`,
        'Parágrafo segundo: O valor estabelecido nesta cláusula corresponde exclusivamente aos serviços descritos neste contrato.',
        'Parágrafo terceiro: Eventuais serviços, análises laboratoriais, ensaios, deslocamentos extraordinários ou outros procedimentos não previstos expressamente neste instrumento poderão ser objeto de contratação ou orçamento específico.'
    ]);

    addClause('CLÁUSULA 7ª – DA VIGÊNCIA', [
        `O presente contrato terá vigência de ${data.duration} meses, iniciando-se em ${formatContractDate(data.start)} e encerrando-se em ${formatContractDate(data.end)}.`,
        'O período de vigência corresponderá ao período da Responsabilidade Técnica formalizada pelo respectivo TRT.'
    ]);

    addClause('CLÁUSULA 8ª – DA RENOVAÇÃO', [
        'Ao término do período de vigência, havendo interesse de ambas as partes na continuidade da Responsabilidade Técnica, o contrato poderá ser renovado para o período subsequente mediante novo ajuste entre as partes e emissão de novo TRT, correspondente ao novo período de Responsabilidade Técnica.',
        'Parágrafo primeiro: A renovação não será automática, devendo ser formalizada entre as partes antes do início do novo período.',
        'Parágrafo segundo: Para cada novo período contratual, as partes poderão renegociar o valor dos serviços, considerando atualização de custos, abrangência dos serviços, condições do local e demais fatores pertinentes.',
        'Parágrafo terceiro: A continuidade da Responsabilidade Técnica após o encerramento da vigência deste contrato dependerá da formalização do novo período e da emissão do respectivo TRT perante o Conselho Profissional competente.'
    ]);

    addClause('CLÁUSULA 9ª – DA RESCISÃO', [
        'O presente contrato poderá ser rescindido:',
        'I – por acordo entre as partes;',
        'II – mediante solicitação de qualquer das partes, mediante comunicação prévia de 30 (trinta) dias;',
        'III – pelo descumprimento de qualquer obrigação estabelecida neste instrumento;',
        'IV – por motivo que impeça legal ou tecnicamente a continuidade da Responsabilidade Técnica.',
        'Parágrafo único: Em caso de encerramento antecipado do contrato, deverão ser observadas as obrigações financeiras já constituídas até a data efetiva do encerramento da prestação dos serviços.'
    ]);

    addClause('CLÁUSULA 10ª – DOS LIMITES DA RESPONSABILIDADE TÉCNICA', [
        'A Responsabilidade Técnica do CONTRATADO estará limitada ao objeto deste contrato e às atividades abrangidas pelo respectivo TRT e pelas atribuições profissionais conferidas pelo Conselho Profissional competente.',
        'O CONTRATADO não responderá por intervenções, alterações ou procedimentos realizados pelo CONTRATANTE ou por terceiros sem sua orientação ou conhecimento, especialmente quando tais ações possam interferir na qualidade da água, nos resultados das análises ou nas condições técnicas objeto deste contrato.'
    ]);

    addClause('CLÁUSULA 11ª – DA DOCUMENTAÇÃO TÉCNICA', [
        'Os relatórios, laudos e demais documentos técnicos produzidos no âmbito deste contrato serão disponibilizados ao CONTRATANTE como comprovação das atividades de acompanhamento e Responsabilidade Técnica realizadas durante a vigência contratual.'
    ]);

    addClause('CLÁUSULA 12ª – DO FORO', [
        'Fica eleito o foro da Comarca de Marília, Estado de São Paulo, para dirimir eventuais questões decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.'
    ]);

    if (y > bottom - 79) nextPage();
    addParagraph('E, por estarem de acordo com todas as condições estabelecidas neste instrumento, as partes assinam o presente contrato em duas vias de igual teor e forma.', { after: 5 });
    addParagraph(`Marília, ${formatLongDate(data.signingDate)}.`, { after: 12 });
    const columnWidth = 82;
    const rightColumn = pageWidth - right - columnWidth;
    const signatureTop = y;
    doc.setDrawColor(90, 105, 108);
    doc.line(left, signatureTop, left + columnWidth, signatureTop);
    doc.line(rightColumn, signatureTop, rightColumn + columnWidth, signatureTop);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CONTRATANTE', left, signatureTop + 6);
    doc.text('CONTRATADO', rightColumn, signatureTop + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(`Nome: ${data.client.Representante_Nome}`, columnWidth), left, signatureTop + 13);
    doc.text(doc.splitTextToSize(`CPF: ${data.client.Representante_CPF}`, columnWidth), left, signatureTop + 25);
    doc.text(doc.splitTextToSize('ANTONIO LUCAS TRIBURTINO', columnWidth), rightColumn, signatureTop + 13);
    doc.text('Técnico em Química', rightColumn, signatureTop + 20);
    doc.text(doc.splitTextToSize(`Registro profissional: ${data.registration}`, columnWidth), rightColumn, signatureTop + 27);
    doc.setFontSize(8);
    doc.text('Assinatura', left, signatureTop + 38);
    doc.text('Assinatura', rightColumn, signatureTop + 38);
    doc.line(left, signatureTop + 45, left + columnWidth, signatureTop + 45);
    doc.line(rightColumn, signatureTop + 45, rightColumn + columnWidth, signatureTop + 45);

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(110, 125, 128);
        doc.text(`Página ${page} de ${pages}`, pageWidth / 2, 289, { align: 'center' });
    }
    return doc;
}

function syncContractEndDate() {
    const start = contractDateFields.start.value;
    const duration = Number(document.getElementById('contractDuration').value);
    if (start && Number.isInteger(duration) && duration > 0) {
        contractDateFields.end.value = dateToISO(addMonths(parseISODate(start), duration));
    }
}

contractClient.addEventListener('change', updateContractSignatory);
contractDateFields.start.addEventListener('change', syncContractEndDate);
document.getElementById('contractDuration').addEventListener('input', syncContractEndDate);
document.getElementById('contractForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('A biblioteca de PDF não carregou. Verifique a conexão e recarregue a página.');
        const data = createContractData();
        const doc = buildContractPdf(data);
        doc.save(`Contrato_RT_${safeFilename(data.client.Cliente)}.pdf`);
        msg('contractStatus', `Contrato de ${data.client.Cliente} gerado em PDF.`);
    } catch (error) {
        msg('contractStatus', error.message, 'err');
    }
});

const today = dateToISO(new Date());
contractDateFields.start.value = today;
contractDateFields.signing.value = today;
syncContractEndDate();
renderContractClients();
