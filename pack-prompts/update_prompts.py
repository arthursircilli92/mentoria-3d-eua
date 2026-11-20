import json
from pathlib import Path

data = json.loads(Path('prompts.json').read_text(encoding='utf-8'))

FIDELIDADE = """Use a foto real anexada como referência principal do produto. Preserve geometria, proporções, cor, textura, inscrições, encaixes e componentes visíveis. Se for uma peça impressa em 3D, mantenha as linhas de camada reais. Não transforme a peça em outro modelo nem invente partes ocultas, acessórios, luz própria, movimento ou funções. Use somente características e dados comerciais que eu informar; não deduza material, medidas, resistência, compatibilidade, quantidade vendida ou garantia pela aparência. Objetos de cenário não podem parecer itens inclusos. Se faltarem informações essenciais à tarefa, faça uma pergunta curta antes de gerar; nos demais casos, avance usando apenas o que está confirmado."""

ESTILO = """Produza fotografia publicitária realista, com acabamento profissional e sem aparência de ilustração. Use formato quadrado 1:1, produto nítido, composição limpa e margens seguras. Quando houver texto, escreva em português brasileiro, com frases curtas, ortografia correta, fonte sem serifa e alto contraste. Não inclua preços, descontos, avaliações, selos, logos de marketplace ou marca-d'água inventados. Se eu anexar uma arte anterior como referência de estilo, siga sua paleta e tipografia, mas use a foto original para preservar o produto. Entregue a imagem final, não apenas uma descrição ou um novo prompt."""

def build(task):
    return task.strip() + "\n\n" + FIDELIDADE + "\n\n" + ESTILO

new_prompts = {}

new_prompts['01-capa'] = build("""Gere uma imagem de capa para anúncio de marketplace com o produto da foto anexada. Mostre uma única unidade principal, inteira, sem cortar bordas importantes, ocupando aproximadamente 75% da composição. Escolha um ângulo apoiado pela referência, que permita reconhecer imediatamente o produto.

Use fundo de estúdio claro, sombra de contato suave e iluminação que revele o volume. Não coloque objetos de decoração nem textos promocionais. Preserve qualquer inscrição que já faça parte do próprio produto. A imagem precisa continuar compreensível quando reduzida a uma miniatura.""")

new_prompts['02-beneficios'] = build("""Gere uma imagem de anúncio dedicada ao principal benefício real do produto anexado. Escolha somente uma vantagem sustentada pela foto e pelos dados que forneci. Mostre essa vantagem por meio da composição e use uma chamada de até seis palavras, com no máximo uma frase complementar curta.

Se o apelo confirmado for decorativo, apresente a peça valorizando um ambiente e use a chamada "Mais personalidade para seu espaço". Não invente economia, ergonomia, durabilidade ou desempenho. Dê destaque ao resultado para o comprador, mantendo o produto como protagonista. Evite diagramas técnicos e listas extensas.""")

new_prompts['03-medidas-especificacoes'] = build("""Gere uma imagem técnica de anúncio com as medidas e especificações confirmadas do produto anexado. Use fundo claro, produto grande e linhas de cota finas com setas e unidades legíveis. Cada cota deve começar e terminar exatamente nos pontos correspondentes à medida informada. Se as medidas forem da embalagem, não as aplique ao produto.

Antes de gerar, se eu não tiver fornecido medidas, pergunte: "Quais medidas confirmadas e unidades devem aparecer, e a que pontos da peça elas correspondem?" Não estime dimensões pela foto. Se eu disser que não tenho medidas, gere uma versão intitulada "Detalhes do produto", com até três chamadas para partes realmente visíveis, sem cotas ou números. Inclua material e capacidade somente se eu tiver informado esses dados. Não coloque campos vazios ou valores fictícios na arte.""")

new_prompts['04-produto-em-uso'] = build("""Gere uma imagem publicitária mostrando o produto anexado em sua situação principal de uso. Construa uma única cena realista, com posição, apoio, contato e perspectiva coerentes. Mantenha o produto em destaque e use poucos objetos de contexto.

Só demonstre funcionamento confirmado. Se a foto mostrar uma peça decorativa em formato de luminária, mas não houver confirmação de iluminação, mostre-a posicionada sobre a mesa com luz externa de janela, sem lâmpada acesa, fios adicionados ou brilho saindo da peça. Não adicione mãos ou pessoas se elas não forem necessárias para explicar o uso. Não inclua texto nesta imagem. Evite objetos que sugiram uma escala absoluta não confirmada.""")

new_prompts['05-detalhes-importantes'] = build("""Gere uma imagem de anúncio com destaque para um detalhe importante do produto anexado. Use uma vista do produto inteiro e uma única ampliação do detalhe, conectadas por uma linha discreta. Escolha uma região realmente visível na referência, como textura, junção, encaixe ou acabamento.

Use o título "Veja de perto" e uma legenda curta que descreva o que pode ser observado, sem promessas de qualidade ou resistência não comprovadas. A ampliação deve representar exatamente a mesma peça da vista geral. Não invente mecanismo interno nem use efeito de raio X. Se a região estiver sem definição suficiente, peça um close antes de produzir uma ampliação detalhada.""")

new_prompts['06-o-que-acompanha'] = build("""Gere uma imagem de anúncio intitulada "O que acompanha", mostrando exclusivamente os itens efetivamente incluídos na compra. Organize os componentes sobre fundo neutro, separados e inteiros, com rótulos curtos e quantidades legíveis. Deixe espaço suficiente para o comprador contar cada unidade.

Antes de gerar, se a lista e as quantidades não estiverem confirmadas, pergunte: "Quais itens e quantidades o comprador recebe neste pedido?" Não conclua que várias cores na foto formam um kit. Não inclua embalagem, fonte, cabo, lâmpada, suporte ou acessórios sem confirmação. Se a venda for de uma unidade, mostre uma unidade e escreva "1 unidade por pedido" somente após minha confirmação. Não adicione objetos de cenário.""")

new_prompts['07-aplicacoes'] = build("""Gere uma única imagem quadrada de anúncio mostrando o produto em três contextos adequados. Divida a composição em três áreas bem organizadas, com uma cena maior e duas menores. Use títulos curtos para identificar os ambientes. As cenas representam usos alternativos do mesmo produto, não um kit com várias unidades.

Se for um objeto decorativo de mesa, use contextos domésticos coerentes, como área de trabalho, estante e aparador, sem inventar uso externo ou exposição à água. Para outros produtos, escolha contextos sustentados pelas referências e informações fornecidas. Se houver apenas um uso confirmado, mostre três composições dentro desse mesmo contexto. Não invente compatibilidade com marcas ou modelos. Use o título "Inspire-se nos ambientes" quando o foco for decoração.""")

new_prompts['08-diferenciais'] = build("""Gere uma imagem de anúncio destacando até três atributos concretos e verificáveis do produto anexado. Use uma vista principal grande e chamadas discretas apontando para as regiões correspondentes. Priorize desenho da peça, formato da base, acabamento ou detalhes construtivos visíveis.

Use o título "Detalhes que fazem parte do design" e legendas objetivas. Não afirme que o produto é superior ao concorrente, premium, exclusivo, mais resistente ou sustentável sem informação que sustente a afirmação. Não confunda aparência de articulação com movimento funcional. A composição deve explicar características da própria peça, sem repetir a cena de benefício ou criar um comparativo fictício.""")

new_prompts['09-informacoes-finais'] = build("""Gere a última imagem de uma sequência de anúncio. Mostre o produto com uma vista clara e reserve espaço para até três orientações reais que eu tenha fornecido sobre escolha da versão, uso, cuidados ou condições da oferta. Use o título "Confira antes de comprar".

Não invente temperatura máxima, limpeza, idade indicada, prazo de envio, política de troca ou garantia. Se eu não tiver fornecido orientações, use apenas estas frases neutras: "Confira os detalhes do anúncio" e "Ficou com dúvida? Fale com o vendedor". Evite qualquer selo de garantia ou promessa de disponibilidade. Termine a sequência com uma composição limpa e legível.""")

new_prompts['13-estudio-fundo-branco'] = build("""Gere uma fotografia de catálogo do produto anexado sobre fundo branco puro, sem títulos, legendas ou elementos gráficos. Preserve a vista e a orientação da referência; melhore somente luz, fundo e apresentação. Remova visualmente objetos do ambiente que não façam parte do produto.

Mostre o produto inteiro, centralizado, com espaço livre ao redor para uso em diferentes layouts. Use sombra de contato muito suave para evitar aparência de objeto flutuando. Preserve vazados, transparência real, pequenas bordas e linhas de camada; não apague a textura para parecer plástico liso. Não reconstrua uma vista inédita da parte traseira. Diferentemente de uma capa promocional, esta imagem deve funcionar como foto neutra de catálogo.""")

new_prompts['14-foto-ambientada'] = build("""Gere uma fotografia editorial ambientada do produto anexado. Se eu indicar um ambiente, use-o; caso contrário, escolha um interior contemporâneo e discreto coerente com a peça. Para decoração de mesa, use uma superfície de madeira, fundo suave, luz natural lateral e poucos elementos secundários.

O produto deve permanecer totalmente identificável, em primeiro plano, com espaço negativo e fundo levemente desfocado. Explore harmonia de cores e atmosfera, sem textos ou elementos de infográfico. Evite que plantas, livros ou outros objetos escondam a peça ou pareçam acompanhar a compra. Não use ambiente externo, água ou calor sem indicação de adequação. Preserve a pose original se não houver referência de outros ângulos.""")

new_prompts['15-cinematografica'] = build("""Gere uma imagem publicitária cinematográfica com o produto anexado como protagonista. Use fundo escuro com profundidade, uma superfície discreta e luz lateral dramática combinada com um recorte suave nas bordas. Preserve detalhes nas sombras e a cor verdadeira da peça.

Crie contraste com o fundo e uma composição elegante, sem texto, fumaça cobrindo o produto, partículas, efeitos mágicos ou brilho próprio. A iluminação deve vir do cenário, nunca de uma função inventada do objeto. Se o produto for laranja, uma ambientação azul-petróleo escura pode realçar a peça; para outras cores, escolha contraste coerente. Não altere a textura real para metal, vidro ou outro material.""")

new_prompts['16-macro-textura'] = build("""Gere uma fotografia macro realista de uma única região visível do produto anexado, preenchendo o quadro com textura, bordas e acabamento. Use luz lateral suave para revelar o relevo e profundidade de campo moderada, mantendo a área principal em foco.

Entregue apenas o close, sem vista geral, círculos de ampliação, setas ou textos. Em peças impressas em 3D, preserve as linhas de camada com a aparência e a escala relativa da referência. Não crie sulcos, poros, parafusos ou detalhes para simular riqueza de textura. Se a foto não sustentar um macro fiel, solicite uma fotografia aproximada da região antes de gerar.""")

new_prompts['17-mostruario-cores'] = build("""Gere uma imagem de mostruário das versões do produto que eu confirmar como disponíveis. Apresente cada versão com tamanho visual equivalente, alinhamento consistente, iluminação neutra e espaço suficiente entre elas. Use o título "Escolha sua versão" e o nome confirmado abaixo de cada peça.

Não invente cores a partir de uma única fotografia. Se eu ainda não tiver indicado as versões disponíveis ou enviado referências suficientes, peça essas informações antes de gerar. Preserve o acabamento específico de cada versão: uma peça translúcida deve manter sua translucidez real, sem virar vidro transparente ou plástico opaco. Escreva discretamente "Opções de cor" para indicar que são alternativas. Só informe quantidade por pedido se eu confirmar. Não apresente as versões como um kit.""")

new_prompts['18-lancamento'] = build("""Gere uma arte de apresentação de lançamento para o produto anexado. Use o produto inteiro e grande, um fundo de estúdio com cor coordenada e iluminação que destaque sua silhueta. Coloque "Conheça a novidade" como título e "Veja os detalhes" como chamada secundária.

Se eu informar um nome curto do produto, inclua-o com hierarquia abaixo do título. Caso contrário, omita o nome sem inventar uma marca. Use poucos elementos gráficos, boa área de respiro e composição equilibrada. Não inclua desconto, preço, data, contagem regressiva, número de unidades ou promessa de exclusividade. Não altere o produto para que ele pareça uma edição diferente.""")

new_prompts['19-tema-sazonal'] = build("""Gere uma imagem de campanha sazonal com o produto anexado como protagonista. Se eu não tiver informado a ocasião, pergunte qual tema desejo antes de gerar. Use a ocasião escolhida somente para orientar o fundo, as cores e poucos elementos decorativos.

Não acrescente desenhos, adesivos, chapéus, acessórios ou alterações ao próprio produto. Os elementos temáticos devem ficar no cenário e não parecer inclusos no pedido. Use uma chamada curta relacionada à ocasião, sem afirmar promoção, disponibilidade, embalagem para presente ou entrega antes de uma data. Evite afirmar adequação a crianças ou qualquer público específico sem confirmação. Mantenha o produto bem visível e não cubra detalhes com decoração.""")

updated = 0
for p in data['prompts']:
    if p['id'] in new_prompts:
        p['prompt'] = new_prompts[p['id']]
        updated += 1

Path('prompts.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Atualizados {updated} prompts com textos oficiais')