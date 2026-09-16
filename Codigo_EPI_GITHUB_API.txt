/****************************************************
 * SISTEMA DE CONTROLE DE EPI
 * GRUPO 360 MANUTENÇÃO
 *
 * Controle de entrega de EPI por colaborador.
 * Cada colaborador possui uma ficha de 6 meses.
 *
 * Abas utilizadas:
 * EPI
 * COLABORADORES
 * FICHAS
 * SAIDA EPI
 * ASSINATURAS
 * FOTOS
 ****************************************************/

const CONFIG = {

  // Nomes das abas da planilha
  ABA_EPI: 'EPI',
  ABA_COLABORADORES: 'COLABORADORES',
  ABA_FICHAS: 'FICHAS',
  ABA_SAIDA: 'SAIDA EPI',
  ABA_ASSINATURAS: 'ASSINATURAS',
  ABA_FOTOS: 'FOTOS',

  // Nome da pasta principal no Drive
  PASTA_PRINCIPAL: 'ESTOQUE - EPI',

  // Fuso horário
  FUSO_HORARIO: 'America/Sao_Paulo',

  // Quantidade de meses de cada ficha
  CICLO_MESES: 6
};


/****************************************************
 * ABRE O SISTEMA
 ****************************************************/

/* ============================================================
 * API PARA VERSÃO GITHUB PAGES
 * Cole este bloco no Código.gs e use o doGet abaixo.
 * ============================================================ */

function doGet(e) {
  e = e || {parameter:{}};
  const p = e.parameter || {};

  if (String(p.api || '') === '1') {
    const action = String(p.action || '');
    let resultado;

    if (action === 'carregarDados') resultado = carregarDados();
    else if (action === 'consultarFichaColaborador') resultado = consultarFichaColaborador(p.nome || '');
    else if (action === 'listarFichas') resultado = listarFichas();
    else if (action === 'listarSaidasRecentes') resultado = listarSaidasRecentes(Number(p.limite || 30));
    else if (action === 'listarSaidasPorData') resultado = listarSaidasPorData(p.data || '');
    else resultado = { erro: 'Ação de API não encontrada.' };

    return responderApi_(resultado, p.callback || '');
  }

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Controle de EPI - Grupo 360')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = e && e.parameter ? (e.parameter.payload || '') : '';
    if (!payload) throw new Error('Payload não recebido.');

    const dados = JSON.parse(payload);
    const resultado = registrarEntregaEPI(dados);

    return HtmlService.createHtmlOutput(
      '<!doctype html><html><body><script>' +
      'parent.postMessage(' + JSON.stringify({tipo:'epi_api', sucesso:true, dados:resultado}) + ', "*");' +
      '</script></body></html>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html><body><script>' +
      'parent.postMessage(' + JSON.stringify({tipo:'epi_api', sucesso:false, erro:String(err && err.message || err)}) + ', "*");' +
      '</script></body></html>'
    );
  }
}

function responderApi_(dados, callback) {
  const json = JSON.stringify(dados);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback).replace(/[^a-zA-Z0-9_$.]/g, '') + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function listarSaidasRecentes(limite) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_SAIDA);
  if (!sheet) throw new Error('A aba SAIDA EPI não foi encontrada.');
  return obterSaidasHistorico_(sheet, Math.max(1, Math.min(limite || 30, 200)), '');
}

function listarSaidasPorData(dataTexto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_SAIDA);
  if (!sheet) throw new Error('A aba SAIDA EPI não foi encontrada.');
  return obterSaidasHistorico_(sheet, 500, String(dataTexto || '').trim());
}

function obterSaidasHistorico_(sheet, limite, filtroData) {
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cab = criarMapaCabecalhos_(dados[0]);
  const cData = encontrarColuna_(cab, ['DATA']);
  const cCodigo = encontrarColuna_(cab, ['CÓDIGO INTERNO','CODIGO INTERNO']);
  const cCA = encontrarColuna_(cab, ['CA']);
  const cDesc = encontrarColuna_(cab, ['DESCRIÇÃO','DESCRICAO']);
  const cQtd = encontrarColuna_(cab, ['QUANTIDADE']);
  const cResp = encontrarColuna_(cab, ['RESPONSÁVEL','RESPONSAVEL']);
  const cObs = encontrarColuna_(cab, ['OBSERVAÇÕES','OBSERVACOES']);
  const cFicha = encontrarColuna_(cab, ['ID FICHA']);
  const cAss = encontrarColuna_(cab, ['ASSINATURA']);
  const cFoto = encontrarColuna_(cab, ['FOTO']);

  const resultado = [];
  for (let i = dados.length - 1; i >= 1 && resultado.length < limite; i--) {
    const valorData = cData >= 0 ? dados[i][cData] : '';
    const dataFormatada = valorData ? formatarData_(valorData) : '';
    if (filtroData && dataFormatada !== filtroData) continue;

    resultado.push({
      data: dataFormatada,
      codigo: cCodigo >= 0 ? String(dados[i][cCodigo] || '') : '',
      ca: cCA >= 0 ? String(dados[i][cCA] || '') : '',
      descricao: cDesc >= 0 ? String(dados[i][cDesc] || '') : '',
      quantidade: cQtd >= 0 ? Number(dados[i][cQtd] || 0) : 0,
      responsavel: cResp >= 0 ? String(dados[i][cResp] || '') : '',
      observacoes: cObs >= 0 ? String(dados[i][cObs] || '') : '',
      ficha: cFicha >= 0 ? String(dados[i][cFicha] || '') : '',
      assinatura: cAss >= 0 ? String(dados[i][cAss] || '') : '',
      foto: cFoto >= 0 ? String(dados[i][cFoto] || '') : ''
    });
  }
  return resultado;
}



/****************************************************
 * CONFIGURAÇÃO INICIAL
 *
 * Executar UMA VEZ manualmente no Apps Script.
 *
 * Ela verifica se as abas existem e cria os cabeçalhos
 * necessários caso ainda não estejam configurados.
 ****************************************************/

function configurarSistema() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_EPI,
    [
      'CODIGO',
      'DESCRIÇÃO',
      'CA',
      'UTILIZAÇÃO',
      'ESTOQUE ATUAL',
      'ESTOQUE MÍNIMO'
    ]
  );

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_COLABORADORES,
    [
      'CÓDIGO',
      'NOME',
      'DATA DE ADMISSÃO',
      'FUNÇÃO',
      'ATIVO'
    ]
  );

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_FICHAS,
    [
      'ID FICHA',
      'COLABORADOR',
      'INÍCIO',
      'FIM',
      'STATUS',
      'DATA ENCERRAMENTO'
    ]
  );

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_SAIDA,
    [
      'DATA',
      'CÓDIGO INTERNO',
      'CA',
      'DESCRIÇÃO',
      'QUANTIDADE',
      'RESPONSÁVEL',
      'OBSERVAÇÕES',
      'ID FICHA',
      'ASSINATURA',
      'FOTO'
    ]
  );

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_ASSINATURAS,
    [
      'ID ASSINATURA',
      'ID ENTREGA',
      'COLABORADOR',
      'DATA',
      'HORA',
      'ARQUIVO',
      'URL'
    ]
  );

  criarOuPrepararAba_(
    ss,
    CONFIG.ABA_FOTOS,
    [
      'ID FOTO',
      'ID ENTREGA',
      'COLABORADOR',
      'DATA',
      'HORA',
      'ARQUIVO',
      'URL'
    ]
  );

  criarPastasDrive_();

  return {
    sucesso: true,
    mensagem: 'Sistema configurado com sucesso.'
  };
}


/****************************************************
 * CARREGA OS DADOS INICIAIS DO APP
 ****************************************************/

function carregarDados() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const epiSheet = ss.getSheetByName(CONFIG.ABA_EPI);
  const colSheet = ss.getSheetByName(CONFIG.ABA_COLABORADORES);

  if (!epiSheet) {
    throw new Error('A aba EPI não foi encontrada.');
  }

  if (!colSheet) {
    throw new Error('A aba COLABORADORES não foi encontrada.');
  }

  const epis = obterEPIs_(epiSheet);
  const colaboradores = obterColaboradores_(colSheet);

  return {
    epis: epis,
    colaboradores: colaboradores
  };
}


/****************************************************
 * OBTÉM OS EPIs
 ****************************************************/

function obterEPIs_(sheet) {

  const dados = sheet.getDataRange().getValues();

  if (dados.length < 2) {
    return [];
  }

  const cab = criarMapaCabecalhos_(dados[0]);

  const resultado = [];

  for (let i = 1; i < dados.length; i++) {

    const linha = dados[i];

    const codigo = valorPorCabecalho_(linha, cab, [
      'CODIGO',
      'CÓDIGO'
    ]);

    if (!codigo) {
      continue;
    }

    const descricao = valorPorCabecalho_(linha, cab, [
      'DESCRIÇÃO',
      'DESCRICAO'
    ]);

    const ca = valorPorCabecalho_(linha, cab, ['CA']);

    const utilizacao = valorPorCabecalho_(linha, cab, [
      'UTILIZAÇÃO',
      'UTILIZACAO'
    ]);

    const estoqueAtual = numeroPorCabecalho_(linha, cab, [
      'ESTOQUE ATUAL'
    ]);

    const estoqueMinimo = numeroPorCabecalho_(linha, cab, [
      'ESTOQUE MÍNIMO',
      'ESTOQUE MINIMO'
    ]);

    let statusEstoque = 'OK';

    if (estoqueAtual <= 0) {
      statusEstoque = 'ZERADO';
    } else if (estoqueAtual < estoqueMinimo) {
      statusEstoque = 'ABAIXO DO MÍNIMO';
    }

    resultado.push({
      codigo: String(codigo).trim(),
      descricao: String(descricao || '').trim(),
      ca: String(ca || '').trim(),
      utilizacao: String(utilizacao || '').trim(),
      estoqueAtual: estoqueAtual,
      estoqueMinimo: estoqueMinimo,
      statusEstoque: statusEstoque
    });
  }

  return resultado;
}


/****************************************************
 * OBTÉM COLABORADORES
 ****************************************************/

function obterColaboradores_(sheet) {

  const dados = sheet.getDataRange().getValues();

  if (dados.length < 2) {
    return [];
  }

  const cab = criarMapaCabecalhos_(dados[0]);

  const resultado = [];

  for (let i = 1; i < dados.length; i++) {

    const linha = dados[i];

    const nome = valorPorCabecalho_(linha, cab, [
      'NOME',
      'COLABORADOR'
    ]);

    if (!nome) {
      continue;
    }

    const codigo = valorPorCabecalho_(linha, cab, [
      'CÓDIGO',
      'CODIGO'
    ]);

    const dataAdmissao = valorPorCabecalho_(linha, cab, [
      'DATA DE ADMISSÃO',
      'DATA DE ADMISSAO'
    ]);

    const funcao = valorPorCabecalho_(linha, cab, [
      'FUNÇÃO',
      'FUNCAO',
      'CARGO'
    ]);

    const empresa = valorPorCabecalho_(linha, cab, [
      'EMPRESA'
    ]);

    const cpf = valorPorCabecalho_(linha, cab, [
      'CPF'
    ]);

    const ativo = valorPorCabecalho_(linha, cab, [
      'ATIVO'
    ]);

    resultado.push({
      codigo: String(codigo || '').trim(),
      nome: String(nome).trim(),
      dataAdmissao: formatarData_(dataAdmissao),
      funcao: String(funcao || '').trim(),
      empresa: String(empresa || '').trim(),
      cpf: String(cpf || '').trim(),
      ativo: String(ativo || 'SIM').trim()
    });
  }

  return resultado;
}


/****************************************************
 * REGISTRA UMA ENTREGA DE EPI
 *
 * Recebe:
 *
 * {
 *   colaborador,
 *   codigoEpi,
 *   quantidade,
 *   observacoes,
 *   assinaturaBase64,
 *   fotoBase64
 * }
 ****************************************************/

function registrarEntrega(dados) {

  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    if (!dados) {
      throw new Error('Dados da entrega não recebidos.');
    }

    if (!dados.colaborador) {
      throw new Error('Selecione o colaborador.');
    }

    if (!dados.codigoEpi) {
      throw new Error('Selecione o EPI.');
    }

    const quantidade = Number(dados.quantidade);

    if (!quantidade || quantidade <= 0) {
      throw new Error('Informe uma quantidade válida.');
    }

    if (!dados.assinaturaBase64) {
      throw new Error('A assinatura do colaborador é obrigatória.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const epiSheet = ss.getSheetByName(CONFIG.ABA_EPI);
    const colSheet = ss.getSheetByName(CONFIG.ABA_COLABORADORES);
    const fichaSheet = ss.getSheetByName(CONFIG.ABA_FICHAS);
    const saidaSheet = ss.getSheetByName(CONFIG.ABA_SAIDA);

    if (!epiSheet || !colSheet || !fichaSheet || !saidaSheet) {
      throw new Error(
        'Uma ou mais abas necessárias não foram encontradas.'
      );
    }

    /***********************************************
     * LOCALIZA O EPI
     ***********************************************/

    const epi = localizarEPI_(epiSheet, dados.codigoEpi);

    if (!epi) {
      throw new Error('EPI não encontrado: ' + dados.codigoEpi);
    }

    if (epi.estoqueAtual < quantidade) {

      throw new Error(
        'Estoque insuficiente para o EPI ' +
        epi.codigo +
        '. Estoque atual: ' +
        epi.estoqueAtual
      );

    }


    /***********************************************
     * LOCALIZA O COLABORADOR
     ***********************************************/

    const colaborador = localizarColaborador_(
      colSheet,
      dados.colaborador
    );

    if (!colaborador) {
      throw new Error('Colaborador não encontrado.');
    }


    /***********************************************
     * VERIFICA SE ESTÁ ATIVO
     ***********************************************/

    if (
      colaborador.ativo &&
      String(colaborador.ativo).toUpperCase() === 'NÃO'
    ) {

      throw new Error(
        'Este colaborador está marcado como inativo.'
      );

    }


    /***********************************************
     * OBTÉM OU CRIA A FICHA ATIVA
     ***********************************************/

    const ficha = obterOuCriarFichaAtiva_(
      fichaSheet,
      colaborador
    );


    /***********************************************
     * GERA ID DA ENTREGA
     ***********************************************/

    const idEntrega = gerarId_('EPI');


    /***********************************************
     * DATA E HORA
     ***********************************************/

    const agora = new Date();

    const data = Utilities.formatDate(
      agora,
      CONFIG.FUSO_HORARIO,
      'dd/MM/yyyy'
    );

    const hora = Utilities.formatDate(
      agora,
      CONFIG.FUSO_HORARIO,
      'HH:mm:ss'
    );


    /***********************************************
     * SALVA ASSINATURA
     ***********************************************/

    const arquivoAssinatura = salvarArquivoBase64_(
      dados.assinaturaBase64,
      'assinatura_' + idEntrega,
      'ASSINATURAS - EPI'
    );


    /***********************************************
     * SALVA FOTO, SE HOUVER
     ***********************************************/

    let arquivoFoto = null;

    if (dados.fotoBase64) {

      arquivoFoto = salvarArquivoBase64_(
        dados.fotoBase64,
        'foto_' + idEntrega,
        'FOTOS - EPI'
      );

    }


    /***********************************************
     * REGISTRA NA SAIDA EPI
     ***********************************************/

    const proximaLinha = saidaSheet.getLastRow() + 1;

    saidaSheet
      .getRange(proximaLinha, 1, 1, 10)
      .setValues([[
        agora,
        epi.codigo,
        epi.ca,
        epi.descricao,
        quantidade,
        colaborador.nome,
        dados.observacoes || '',
        ficha.idFicha,
        arquivoAssinatura.url,
        arquivoFoto ? arquivoFoto.url : ''
      ]]);


    /***********************************************
     * BAIXA O ESTOQUE
     ***********************************************/

    atualizarEstoque_(
      epiSheet,
      epi.linha,
      epi.colunaEstoqueAtual,
      epi.estoqueAtual - quantidade
    );


    /***********************************************
     * REGISTRA ASSINATURA
     ***********************************************/

    const assinaturaSheet =
      ss.getSheetByName(CONFIG.ABA_ASSINATURAS);

    if (assinaturaSheet) {

      assinaturaSheet.appendRow([
        gerarId_('ASS'),
        idEntrega,
        colaborador.nome,
        agora,
        hora,
        arquivoAssinatura.nome,
        arquivoAssinatura.url
      ]);

    }


    /***********************************************
     * REGISTRA FOTO
     ***********************************************/

    if (arquivoFoto) {

      const fotoSheet =
        ss.getSheetByName(CONFIG.ABA_FOTOS);

      if (fotoSheet) {

        fotoSheet.appendRow([
          gerarId_('FOT'),
          idEntrega,
          colaborador.nome,
          agora,
          hora,
          arquivoFoto.nome,
          arquivoFoto.url
        ]);

      }

    }


    /***********************************************
     * RETORNO PARA O APP
     ***********************************************/

    return {
      sucesso: true,
      idEntrega: idEntrega,
      ficha: ficha.idFicha,
      colaborador: colaborador.nome,
      epi: epi.descricao,
      quantidade: quantidade,
      assinatura: arquivoAssinatura.url,
      foto: arquivoFoto ? arquivoFoto.url : '',
      mensagem:
        'Entrega registrada com sucesso!'
    };

  } finally {

    lock.releaseLock();

  }

}


/****************************************************
 * REGISTRA UMA ENTREGA DE EPI - VÁRIOS ITENS
 *
 * Usado pelo Index.html atual.
 * Uma entrega/evento pode conter vários EPIs,
 * compartilhando a mesma assinatura e foto.
 ****************************************************/
function registrarEntregaEPI(dados) {

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!dados) throw new Error('Dados da entrega não recebidos.');
    if (!dados.colaborador) throw new Error('Selecione o colaborador.');
    if (!Array.isArray(dados.itens) || dados.itens.length === 0) {
      throw new Error('Adicione pelo menos um EPI à entrega.');
    }
    if (!dados.assinaturaBase64) {
      throw new Error('A assinatura do colaborador é obrigatória.');
    }
    if (!dados.fotoBase64) {
      throw new Error('A foto do recebimento é obrigatória.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const epiSheet = ss.getSheetByName(CONFIG.ABA_EPI);
    const colSheet = ss.getSheetByName(CONFIG.ABA_COLABORADORES);
    const fichaSheet = ss.getSheetByName(CONFIG.ABA_FICHAS);
    const saidaSheet = ss.getSheetByName(CONFIG.ABA_SAIDA);
    const assinaturaSheet = ss.getSheetByName(CONFIG.ABA_ASSINATURAS);
    const fotoSheet = ss.getSheetByName(CONFIG.ABA_FOTOS);

    if (!epiSheet || !colSheet || !fichaSheet || !saidaSheet) {
      throw new Error('Uma ou mais abas necessárias não foram encontradas.');
    }

    const colaborador = localizarColaborador_(colSheet, dados.colaborador);
    if (!colaborador) throw new Error('Colaborador não encontrado.');

    if (colaborador.ativo && String(colaborador.ativo).toUpperCase() === 'NÃO') {
      throw new Error('Este colaborador está marcado como inativo.');
    }

    // Consolida itens repetidos pelo mesmo código.
    const itensMapa = {};
    dados.itens.forEach(function(item) {
      if (!item || !item.codigoEpi) return;
      const codigo = String(item.codigoEpi).trim().toUpperCase();
      const quantidade = Number(item.quantidade);
      if (!quantidade || quantidade <= 0) {
        throw new Error('Informe uma quantidade válida para todos os EPIs.');
      }
      itensMapa[codigo] = (itensMapa[codigo] || 0) + quantidade;
    });

    const codigos = Object.keys(itensMapa);
    if (!codigos.length) throw new Error('Adicione pelo menos um EPI válido.');

    // Valida todos os EPIs e todo o estoque ANTES de alterar a planilha.
    const itensValidados = [];
    codigos.forEach(function(codigo) {
      const epi = localizarEPI_(epiSheet, codigo);
      if (!epi) throw new Error('EPI não encontrado: ' + codigo);

      const quantidade = itensMapa[codigo];
      if (epi.estoqueAtual < quantidade) {
        throw new Error(
          'Estoque insuficiente para o EPI ' + epi.codigo +
          '. Estoque atual: ' + epi.estoqueAtual +
          '. Solicitado: ' + quantidade
        );
      }

      itensValidados.push({
        epi: epi,
        quantidade: quantidade
      });
    });

    // Garante que a entrega seja vinculada à ficha vigente de 6 meses.
    const ficha = obterOuCriarFichaAtiva_(fichaSheet, colaborador);
    const idEntrega = gerarId_('EPI');
    const agora = new Date();
    const hora = Utilities.formatDate(agora, CONFIG.FUSO_HORARIO, 'HH:mm:ss');
    const observacoes = String(dados.observacoes || '').trim();

    // Salva assinatura e foto do evento.
    const arquivoAssinatura = salvarArquivoBase64_(
      dados.assinaturaBase64,
      'assinatura_' + idEntrega,
      'ASSINATURAS - EPI'
    );

    if (!arquivoAssinatura) {
      throw new Error('Não foi possível salvar a assinatura.');
    }

    const arquivoFoto = salvarArquivoBase64_(
      dados.fotoBase64,
      'foto_' + idEntrega,
      'FOTOS - EPI'
    );

    if (!arquivoFoto) {
      throw new Error('Não foi possível salvar a foto.');
    }

    // Cada EPI ocupa uma linha na SAIDA EPI, mas todos recebem o mesmo ID Ficha,
    // ID da entrega, assinatura e foto do evento.
    const linhas = itensValidados.map(function(item) {
      return [
        agora,
        item.epi.codigo,
        item.epi.ca,
        item.epi.descricao,
        item.quantidade,
        colaborador.nome,
        observacoes,
        ficha.idFicha,
        arquivoAssinatura.url,
        arquivoFoto.url
      ];
    });

    saidaSheet
      .getRange(saidaSheet.getLastRow() + 1, 1, linhas.length, 10)
      .setValues(linhas);

    // Baixa o estoque de cada item.
    itensValidados.forEach(function(item) {
      atualizarEstoque_(
        epiSheet,
        item.epi.linha,
        item.epi.colunaEstoqueAtual,
        item.epi.estoqueAtual - item.quantidade
      );
    });

    // Registro resumido do evento de assinatura.
    if (assinaturaSheet) {
      assinaturaSheet.appendRow([
        gerarId_('ASS'),
        idEntrega,
        colaborador.nome,
        agora,
        hora,
        arquivoAssinatura.nome,
        arquivoAssinatura.url
      ]);
    }

    // Registro resumido do evento de foto.
    if (fotoSheet) {
      fotoSheet.appendRow([
        gerarId_('FOT'),
        idEntrega,
        colaborador.nome,
        agora,
        hora,
        arquivoFoto.nome,
        arquivoFoto.url
      ]);
    }

    return {
      sucesso: true,
      idEntrega: idEntrega,
      ficha: ficha.idFicha,
      colaborador: colaborador.nome,
      quantidadeItens: itensValidados.length,
      dataHora: Utilities.formatDate(agora, CONFIG.FUSO_HORARIO, 'dd/MM/yyyy HH:mm:ss'),
      itens: itensValidados.map(function(item) {
        return {
          codigo: item.epi.codigo,
          epi: item.epi.descricao,
          quantidade: item.quantidade
        };
      }),
      assinatura: arquivoAssinatura.url,
      foto: arquivoFoto.url,
      mensagem: 'Entrega registrada com sucesso!'
    };

  } finally {
    lock.releaseLock();
  }
}


/****************************************************
 * LOCALIZA EPI
 ****************************************************/

function localizarEPI_(sheet, codigo) {

  const dados = sheet.getDataRange().getValues();

  if (dados.length < 2) {
    return null;
  }

  const cab = criarMapaCabecalhos_(dados[0]);

  const colCodigo = encontrarColuna_(cab, [
    'CODIGO',
    'CÓDIGO'
  ]);

  const colDescricao = encontrarColuna_(cab, [
    'DESCRIÇÃO',
    'DESCRICAO'
  ]);

  const colCA = encontrarColuna_(cab, ['CA']);

  const colEstoque = encontrarColuna_(cab, [
    'ESTOQUE ATUAL'
  ]);

  const colUtilizacao = encontrarColuna_(cab, [
    'UTILIZAÇÃO',
    'UTILIZACAO'
  ]);

  if (
    colCodigo === -1 ||
    colDescricao === -1 ||
    colEstoque === -1
  ) {
    throw new Error(
      'A aba EPI precisa possuir as colunas Código, Descrição e Estoque Atual.'
    );
  }

  for (let i = 1; i < dados.length; i++) {

    const codigoLinha =
      String(dados[i][colCodigo] || '').trim();

    if (
      codigoLinha.toUpperCase() ===
      String(codigo).trim().toUpperCase()
    ) {

      return {
        linha: i + 1,
        codigo: codigoLinha,
        descricao: String(
          dados[i][colDescricao] || ''
        ).trim(),

        ca: colCA >= 0
          ? String(dados[i][colCA] || '').trim()
          : '',

        utilizacao: colUtilizacao >= 0
          ? String(dados[i][colUtilizacao] || '').trim()
          : '',

        estoqueAtual: Number(
          dados[i][colEstoque] || 0
        ),

        colunaEstoqueAtual: colEstoque + 1
      };

    }

  }

  return null;
}


/****************************************************
 * LOCALIZA COLABORADOR
 ****************************************************/

function localizarColaborador_(sheet, nome) {

  const dados = sheet.getDataRange().getValues();

  if (dados.length < 2) {
    return null;
  }

  const cab = criarMapaCabecalhos_(dados[0]);

  const colNome = encontrarColuna_(cab, [
    'NOME',
    'COLABORADOR'
  ]);

  const colCodigo = encontrarColuna_(cab, [
    'CÓDIGO',
    'CODIGO'
  ]);

  const colAdmissao = encontrarColuna_(cab, [
    'DATA DE ADMISSÃO',
    'DATA DE ADMISSAO'
  ]);

  const colFuncao = encontrarColuna_(cab, [
    'FUNÇÃO',
    'FUNCAO',
    'CARGO'
  ]);

  const colAtivo = encontrarColuna_(cab, [
    'ATIVO'
  ]);

  if (colNome === -1) {
    throw new Error(
      'A aba COLABORADORES precisa possuir a coluna NOME.'
    );
  }

  for (let i = 1; i < dados.length; i++) {

    const nomeLinha =
      String(dados[i][colNome] || '').trim();

    if (
      nomeLinha.toUpperCase() ===
      String(nome).trim().toUpperCase()
    ) {

      return {

        linha: i + 1,

        codigo:
          colCodigo >= 0
            ? String(dados[i][colCodigo] || '').trim()
            : '',

        nome: nomeLinha,

        dataAdmissao:
          colAdmissao >= 0
            ? dados[i][colAdmissao]
            : '',

        funcao:
          colFuncao >= 0
            ? String(dados[i][colFuncao] || '').trim()
            : '',

        ativo:
          colAtivo >= 0
            ? String(dados[i][colAtivo] || 'SIM').trim()
            : 'SIM'
      };

    }

  }

  return null;
}


/****************************************************
 * OBTÉM OU CRIA A FICHA ATIVA
 ****************************************************/

function obterOuCriarFichaAtiva_(sheet, colaborador) {

  const dados = sheet.getDataRange().getValues();

  const hoje = inicioDoDia_(new Date());

  /***********************************************
   * PRIMEIRO PROCURA UMA FICHA EXISTENTE
   ***********************************************/

  if (dados.length >= 2) {

    const cab = criarMapaCabecalhos_(dados[0]);

    const colId = encontrarColuna_(cab, [
      'ID FICHA'
    ]);

    const colColaborador = encontrarColuna_(cab, [
      'COLABORADOR'
    ]);

    const colInicio = encontrarColuna_(cab, [
      'INÍCIO',
      'INICIO'
    ]);

    const colFim = encontrarColuna_(cab, [
      'FIM'
    ]);

    const colStatus = encontrarColuna_(cab, [
      'STATUS'
    ]);

    if (
      colId >= 0 &&
      colColaborador >= 0 &&
      colInicio >= 0 &&
      colFim >= 0
    ) {

      for (let i = dados.length - 1; i >= 1; i--) {

        const nome =
          String(
            dados[i][colColaborador] || ''
          ).trim();

        if (
          nome.toUpperCase() !==
          colaborador.nome.toUpperCase()
        ) {
          continue;
        }

        const inicio =
          converterData_(dados[i][colInicio]);

        const fim =
          converterData_(dados[i][colFim]);

        if (!inicio || !fim) {
          continue;
        }

        if (
          hoje >= inicio &&
          hoje <= fim
        ) {

          return {
            idFicha:
              String(dados[i][colId]),

            inicio: inicio,

            fim: fim
          };

        }

      }

    }

  }


  /***********************************************
   * NÃO ENCONTROU → CRIA UMA NOVA
   ***********************************************/

  let inicio;

  if (colaborador.dataAdmissao) {

    const admissao =
      converterData_(colaborador.dataAdmissao);

    if (admissao) {

      inicio =
        inicioDoDia_(admissao);

      /*
       * Avança os ciclos de 6 meses até encontrar
       * o ciclo que contém a data de hoje.
       */

      while (
        adicionarMeses_(inicio, CONFIG.CICLO_MESES) <= hoje
      ) {

        inicio =
          adicionarMeses_(
            inicio,
            CONFIG.CICLO_MESES
          );

      }

    }

  }

  /*
   * Se a data de admissão não estiver cadastrada,
   * usamos a data atual para iniciar a ficha.
   */

  if (!inicio) {
    inicio = hoje;
  }

  const fim =
    adicionarDias_(
      adicionarMeses_(
        inicio,
        CONFIG.CICLO_MESES
      ),
      -1
    );

  // Ao iniciar um novo ciclo, encerra a ficha anterior do mesmo colaborador.
  if (dados.length >= 2) {
    const cabAnterior = criarMapaCabecalhos_(dados[0]);
    const colIdAnterior = encontrarColuna_(cabAnterior, ['ID FICHA']);
    const colColaboradorAnterior = encontrarColuna_(cabAnterior, ['COLABORADOR']);
    const colInicioAnterior = encontrarColuna_(cabAnterior, ['INÍCIO', 'INICIO']);
    const colFimAnterior = encontrarColuna_(cabAnterior, ['FIM']);
    const colStatusAnterior = encontrarColuna_(cabAnterior, ['STATUS']);

    if (colColaboradorAnterior >= 0 && colFimAnterior >= 0 && colStatusAnterior >= 0) {
      for (let j = 1; j < dados.length; j++) {
        const nomeAnterior = String(dados[j][colColaboradorAnterior] || '').trim();
        if (nomeAnterior.toUpperCase() !== colaborador.nome.toUpperCase()) continue;

        const fimAnterior = converterData_(dados[j][colFimAnterior]);
        if (fimAnterior && fimAnterior < hoje) {
          sheet.getRange(j + 1, colStatusAnterior + 1).setValue('ENCERRADA');
        }
      }
    }
  }

  const idFicha = gerarId_('FIC');

  sheet.appendRow([
    idFicha,
    colaborador.nome,
    inicio,
    fim,
    'ATIVA',
    ''
  ]);

  return {
    idFicha: idFicha,
    inicio: inicio,
    fim: fim
  };
}


/****************************************************
 * ATUALIZA ESTOQUE
 ****************************************************/

function atualizarEstoque_(
  sheet,
  linha,
  coluna,
  novoValor
) {

  sheet
    .getRange(linha, coluna)
    .setValue(novoValor);

}


/****************************************************
 * SALVA ARQUIVO BASE64 NO DRIVE
 ****************************************************/

function salvarArquivoBase64_(
  base64,
  nomeBase,
  nomePasta
) {

  if (!base64) {
    return null;
  }

  const partes = String(base64).split(',');

  let mimeType = 'image/png';

  if (
    partes[0] &&
    partes[0].indexOf('data:') === 0
  ) {

    const match =
      partes[0].match(/data:(.*?);base64/);

    if (match) {
      mimeType = match[1];
    }

  }

  const conteudo =
    partes.length > 1
      ? partes[1]
      : partes[0];

  const bytes =
    Utilities.base64Decode(conteudo);

  let extensao = 'png';

  if (mimeType.indexOf('jpeg') >= 0) {
    extensao = 'jpg';
  }

  if (mimeType.indexOf('webp') >= 0) {
    extensao = 'webp';
  }

  const blob =
    Utilities.newBlob(
      bytes,
      mimeType,
      nomeBase + '.' + extensao
    );

  const pasta =
    obterOuCriarPasta_(nomePasta);

  const arquivo =
    pasta.createFile(blob);

  return {
    nome: arquivo.getName(),
    url: arquivo.getUrl(),
    id: arquivo.getId()
  };
}


/****************************************************
 * CRIA AS PASTAS NO DRIVE
 ****************************************************/

function criarPastasDrive_() {

  const principal =
    obterOuCriarPasta_(
      CONFIG.PASTA_PRINCIPAL
    );

  obterOuCriarSubpasta_(
    principal,
    'ASSINATURAS - EPI'
  );

  obterOuCriarSubpasta_(
    principal,
    'FOTOS - EPI'
  );

}


/****************************************************
 * OBTÉM PASTA
 ****************************************************/

function obterOuCriarPasta_(nomePasta) {

  const pastas =
    DriveApp.getFoldersByName(nomePasta);

  if (pastas.hasNext()) {
    return pastas.next();
  }

  return DriveApp.createFolder(nomePasta);
}


/****************************************************
 * OBTÉM SUBPASTA
 ****************************************************/

function obterOuCriarSubpasta_(
  pastaPai,
  nome
) {

  const pastas =
    pastaPai.getFoldersByName(nome);

  if (pastas.hasNext()) {
    return pastas.next();
  }

  return pastaPai.createFolder(nome);
}


/****************************************************
 * CRIA/PREPARA ABA
 ****************************************************/

function criarOuPrepararAba_(
  ss,
  nome,
  cabecalhos
) {

  let sheet =
    ss.getSheetByName(nome);

  if (!sheet) {

    sheet =
      ss.insertSheet(nome);

  }

  if (sheet.getLastRow() === 0) {

    sheet
      .getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos]);

  }

}


/****************************************************
 * MAPA DE CABEÇALHOS
 ****************************************************/

function criarMapaCabecalhos_(cabecalhos) {

  const mapa = {};

  for (let i = 0; i < cabecalhos.length; i++) {

    const nome =
      normalizarTexto_(
        cabecalhos[i]
      );

    if (nome) {
      mapa[nome] = i;
    }

  }

  return mapa;
}


/****************************************************
 * ENCONTRA COLUNA
 ****************************************************/

function encontrarColuna_(
  mapa,
  nomes
) {

  for (let i = 0; i < nomes.length; i++) {

    const nome =
      normalizarTexto_(
        nomes[i]
      );

    if (
      Object.prototype.hasOwnProperty.call(
        mapa,
        nome
      )
    ) {

      return mapa[nome];

    }

  }

  return -1;
}


/****************************************************
 * VALOR POR CABEÇALHO
 ****************************************************/

function valorPorCabecalho_(
  linha,
  mapa,
  nomes
) {

  const coluna =
    encontrarColuna_(
      mapa,
      nomes
    );

  if (coluna < 0) {
    return '';
  }

  return linha[coluna];
}


/****************************************************
 * NÚMERO POR CABEÇALHO
 ****************************************************/

function numeroPorCabecalho_(
  linha,
  mapa,
  nomes
) {

  const valor =
    valorPorCabecalho_(
      linha,
      mapa,
      nomes
    );

  if (
    valor === '' ||
    valor === null ||
    valor === undefined
  ) {

    return 0;

  }

  return Number(valor) || 0;
}


/****************************************************
 * NORMALIZA TEXTO
 ****************************************************/

function normalizarTexto_(valor) {

  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

}


/****************************************************
 * GERA ID
 ****************************************************/

function gerarId_(prefixo) {

  const agora =
    Utilities.formatDate(
      new Date(),
      CONFIG.FUSO_HORARIO,
      'yyyyMMddHHmmss'
    );

  const aleatorio =
    Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(3, '0');

  return prefixo + '-' + agora + '-' + aleatorio;
}


/****************************************************
 * FORMATA DATA
 ****************************************************/

function formatarData_(valor) {

  if (!valor) {
    return '';
  }

  const data =
    converterData_(valor);

  if (!data) {
    return String(valor);
  }

  return Utilities.formatDate(
    data,
    CONFIG.FUSO_HORARIO,
    'dd/MM/yyyy'
  );
}


/****************************************************
 * CONVERTE DATA
 ****************************************************/

function converterData_(valor) {

  if (!valor) {
    return null;
  }

  if (
    Object.prototype.toString.call(valor) ===
    '[object Date]'
  ) {

    if (isNaN(valor.getTime())) {
      return null;
    }

    return inicioDoDia_(valor);

  }

  const texto =
    String(valor).trim();

  if (!texto) {
    return null;
  }

  /*
   * Formato dd/MM/yyyy
   */

  const partes =
    texto.split('/');

  if (partes.length === 3) {

    const dia =
      Number(partes[0]);

    const mes =
      Number(partes[1]) - 1;

    const ano =
      Number(partes[2]);

    const data =
      new Date(
        ano,
        mes,
        dia
      );

    if (!isNaN(data.getTime())) {
      return inicioDoDia_(data);
    }

  }

  const data =
    new Date(texto);

  if (isNaN(data.getTime())) {
    return null;
  }

  return inicioDoDia_(data);
}


/****************************************************
 * INÍCIO DO DIA
 ****************************************************/

function inicioDoDia_(data) {

  return new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate()
  );

}


/****************************************************
 * ADICIONA MESES
 ****************************************************/

function adicionarMeses_(
  data,
  meses
) {

  const nova =
    new Date(data);

  const dia =
    nova.getDate();

  nova.setDate(1);

  nova.setMonth(
    nova.getMonth() + meses
  );

  const ultimoDia =
    new Date(
      nova.getFullYear(),
      nova.getMonth() + 1,
      0
    ).getDate();

  nova.setDate(
    Math.min(
      dia,
      ultimoDia
    )
  );

  return inicioDoDia_(nova);
}


/****************************************************
 * ADICIONA DIAS
 ****************************************************/

function adicionarDias_(
  data,
  dias
) {

  const nova =
    new Date(data);

  nova.setDate(
    nova.getDate() + dias
  );

  return inicioDoDia_(nova);
}

/****************************************************
 * TEXTO PADRÃO DA CAUTELA DE EPI
 ****************************************************/
const TEXTO_CAUTELA_EPI =
  'Pelo presente, declaro ter recebido da empresa ________________________________, os EPI abaixo relacionados, para serem utilizados no exercício da função a serviço da empresa, assumindo o compromisso de usá-los em trabalho, zelar pela sua guarda e conservação e devolvê-los ao setor responsável da empresa quando se tornar impróprio para uso, por motivo de demissão ou afastamento!\n\n' +
  'Em caso de perda, extravio ou avaria proposital dos equipamentos e ferramentas recebidos, autorizo a empresa na forma prevista no parágrafo primeiro do Art. 462 da Consolidação das Leis do Trabalho (CLT), a descontar de meu salário, a importância correspondente ao valor do material, inclusive no que couber a título de indenização por rescisão de contrato de trabalho!\n\n' +
  'Na constatação de defeito de fabricação ou danificação, provocadas acidentalmente, ou por desgastes de uso de qualquer um dos materiais, comprometo-me a entregá-lo(s) ao setor responsável, mediante recibo. E também, em caso de minha demissão e/ou afastamento por qualquer circunstância.';

/****************************************************
 * CONSULTA A FICHA DO COLABORADOR
 ****************************************************/
function consultarFichaColaborador(nome) {
  if (!nome) throw new Error('Informe o colaborador.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const colSheet = ss.getSheetByName(CONFIG.ABA_COLABORADORES);
  const fichaSheet = ss.getSheetByName(CONFIG.ABA_FICHAS);
  const saidaSheet = ss.getSheetByName(CONFIG.ABA_SAIDA);

  if (!colSheet || !fichaSheet || !saidaSheet) {
    throw new Error('As abas COLABORADORES, FICHAS e SAIDA EPI são necessárias.');
  }

  const colaborador = localizarColaborador_(colSheet, nome);
  if (!colaborador) throw new Error('Colaborador não encontrado.');

  const fichas = obterFichasDoColaborador_(fichaSheet, colaborador.nome);
  if (!fichas.length) {
    return {
      empresa: 'Grupo 360 Manutenção',
      textoCautela: TEXTO_CAUTELA_EPI,
      colaborador: {
        codigo: colaborador.codigo,
        nome: colaborador.nome,
        dataAdmissao: formatarData_(colaborador.dataAdmissao),
        funcao: colaborador.funcao,
        empresa: colaborador.empresa,
        cpf: colaborador.cpf
      },
      ficha: null,
      entregas: []
    };
  }

  const hoje = inicioDoDia_(new Date());
  let fichaSelecionada = fichas.find(function(f) {
    return hoje >= f.inicio && hoje <= f.fim;
  });

  // Se não houver ficha vigente, mostra a ficha mais recente sem criar uma nova.
  if (!fichaSelecionada) fichaSelecionada = fichas[fichas.length - 1];

  return {
    empresa: 'Grupo 360 Manutenção',
    textoCautela: TEXTO_CAUTELA_EPI,
    colaborador: {
      codigo: colaborador.codigo,
      nome: colaborador.nome,
      dataAdmissao: formatarData_(colaborador.dataAdmissao),
      funcao: colaborador.funcao,
      empresa: colaborador.empresa,
      cpf: colaborador.cpf
    },
    ficha: {
      idFicha: fichaSelecionada.idFicha,
      inicio: formatarData_(fichaSelecionada.inicio),
      fim: formatarData_(fichaSelecionada.fim),
      status: fichaSelecionada.status
    },
    entregas: obterEntregasDaFicha_(saidaSheet, fichaSelecionada.idFicha)
  };
}

/****************************************************
 * OBTÉM TODAS AS FICHAS DE UM COLABORADOR
 ****************************************************/
function obterFichasDoColaborador_(sheet, nome) {
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cab = criarMapaCabecalhos_(dados[0]);
  const colId = encontrarColuna_(cab, ['ID FICHA']);
  const colColaborador = encontrarColuna_(cab, ['COLABORADOR']);
  const colInicio = encontrarColuna_(cab, ['INÍCIO', 'INICIO']);
  const colFim = encontrarColuna_(cab, ['FIM']);
  const colStatus = encontrarColuna_(cab, ['STATUS']);

  if (colId < 0 || colColaborador < 0 || colInicio < 0 || colFim < 0) return [];

  const resultado = [];
  for (let i = 1; i < dados.length; i++) {
    const nomeLinha = String(dados[i][colColaborador] || '').trim();
    if (nomeLinha.toUpperCase() !== String(nome).trim().toUpperCase()) continue;

    const inicio = converterData_(dados[i][colInicio]);
    const fim = converterData_(dados[i][colFim]);
    if (!inicio || !fim) continue;

    resultado.push({
      idFicha: String(dados[i][colId] || '').trim(),
      inicio: inicio,
      fim: fim,
      status: colStatus >= 0 ? String(dados[i][colStatus] || '').trim() : ''
    });
  }

  resultado.sort(function(a, b) { return a.inicio - b.inicio; });
  return resultado;
}

/****************************************************
 * OBTÉM AS ENTREGAS DE UMA FICHA
 ****************************************************/
function obterEntregasDaFicha_(sheet, idFicha) {
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cab = criarMapaCabecalhos_(dados[0]);
  const colData = encontrarColuna_(cab, ['DATA']);
  const colCodigo = encontrarColuna_(cab, ['CÓDIGO INTERNO', 'CODIGO INTERNO']);
  const colCA = encontrarColuna_(cab, ['CA']);
  const colDescricao = encontrarColuna_(cab, ['DESCRIÇÃO', 'DESCRICAO']);
  const colQuantidade = encontrarColuna_(cab, ['QUANTIDADE']);
  const colResponsavel = encontrarColuna_(cab, ['RESPONSÁVEL', 'RESPONSAVEL']);
  const colObs = encontrarColuna_(cab, ['OBSERVAÇÕES', 'OBSERVACOES']);
  const colFicha = encontrarColuna_(cab, ['ID FICHA']);
  const colAssinatura = encontrarColuna_(cab, ['ASSINATURA']);
  const colFoto = encontrarColuna_(cab, ['FOTO']);

  if (colFicha < 0) return [];

  const resultado = [];
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][colFicha] || '').trim() !== String(idFicha).trim()) continue;

    resultado.push({
      data: colData >= 0 ? formatarData_(dados[i][colData]) : '',
      codigo: colCodigo >= 0 ? String(dados[i][colCodigo] || '').trim() : '',
      ca: colCA >= 0 ? String(dados[i][colCA] || '').trim() : '',
      descricao: colDescricao >= 0 ? String(dados[i][colDescricao] || '').trim() : '',
      quantidade: colQuantidade >= 0 ? Number(dados[i][colQuantidade] || 0) : 0,
      responsavel: colResponsavel >= 0 ? String(dados[i][colResponsavel] || '').trim() : '',
      observacoes: colObs >= 0 ? String(dados[i][colObs] || '').trim() : '',
      assinatura: colAssinatura >= 0 ? String(dados[i][colAssinatura] || '').trim() : '',
      foto: colFoto >= 0 ? String(dados[i][colFoto] || '').trim() : ''
    });
  }

  return resultado;
}

/****************************************************
 * LISTA FICHAS PARA O APP
 ****************************************************/
function listarFichas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fichaSheet = ss.getSheetByName(CONFIG.ABA_FICHAS);
  const saidaSheet = ss.getSheetByName(CONFIG.ABA_SAIDA);
  if (!fichaSheet || !saidaSheet) throw new Error('As abas FICHAS e SAIDA EPI são necessárias.');

  const dados = fichaSheet.getDataRange().getValues();
  if (dados.length < 2) return [];

  const cab = criarMapaCabecalhos_(dados[0]);
  const colId = encontrarColuna_(cab, ['ID FICHA']);
  const colColaborador = encontrarColuna_(cab, ['COLABORADOR']);
  const colInicio = encontrarColuna_(cab, ['INÍCIO', 'INICIO']);
  const colFim = encontrarColuna_(cab, ['FIM']);
  const colStatus = encontrarColuna_(cab, ['STATUS']);
  const entregas = obterTodasEntregasComFicha_(saidaSheet);
  const hoje = inicioDoDia_(new Date());

  const resultado = [];
  for (let i = 1; i < dados.length; i++) {
    const id = colId >= 0 ? String(dados[i][colId] || '').trim() : '';
    if (!id) continue;

    const inicio = colInicio >= 0 ? converterData_(dados[i][colInicio]) : null;
    const fim = colFim >= 0 ? converterData_(dados[i][colFim]) : null;
    const statusPlanilha = colStatus >= 0 ? String(dados[i][colStatus] || '').trim() : '';
    const vigente = inicio && fim && hoje >= inicio && hoje <= fim;

    resultado.push({
      idFicha: id,
      colaborador: colColaborador >= 0 ? String(dados[i][colColaborador] || '').trim() : '',
      inicio: inicio ? formatarData_(inicio) : '',
      fim: fim ? formatarData_(fim) : '',
      status: vigente ? 'ATIVA' : (statusPlanilha || 'ENCERRADA'),
      quantidadeEntregas: entregas[id] || 0
    });
  }

  resultado.sort(function(a, b) { return a.colaborador.localeCompare(b.colaborador) || b.inicio.localeCompare(a.inicio); });
  return resultado;
}

function obterTodasEntregasComFicha_(sheet) {
  const dados = sheet.getDataRange().getValues();
  if (dados.length < 2) return {};
  const cab = criarMapaCabecalhos_(dados[0]);
  const colFicha = encontrarColuna_(cab, ['ID FICHA']);
  const mapa = {};
  if (colFicha < 0) return mapa;
  for (let i = 1; i < dados.length; i++) {
    const id = String(dados[i][colFicha] || '').trim();
    if (!id) continue;
    mapa[id] = (mapa[id] || 0) + 1;
  }
  return mapa;
}

