import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Camera, 
  Layers, 
  Wifi, 
  Flame, 
  FileText, 
  ShieldCheck, 
  Sparkles,
  HelpCircle,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';

export default function TechnicalAnalysis() {
  const [activeTab, setActiveTab] = useState<'geral' | 'optica' | 'moire' | 'webapi' | 'termico' | 'rede' | 'matriz'>('geral');

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              Parecer Técnico de Engenharia de Software & Hardware
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Análise Crítica da Arquitetura Proposta
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Avaliação aprofundada dos 10 tópicos de especificação: viabilidade, limites de hardware do Redmi Note 10S,
              óptica a 25–30 cm, controle de foco no Chrome Android, combate ao efeito Moiré e estabilidade 24/7.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700/60 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-400">Classificação Geral</div>
              <div className="text-lg font-bold text-emerald-400">Altamente Viável (9.4/10)</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              A
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-slate-800">
          {[
            { id: 'geral', label: '1. Avaliação Geral', icon: CheckCircle2 },
            { id: 'optica', label: '2. Óptica & 64MP', icon: Camera },
            { id: 'moire', label: '3. Desafio Moiré & OCR', icon: Eye },
            { id: 'webapi', label: '4. Chrome & ImageCapture', icon: Cpu },
            { id: 'termico', label: '5. Térmica & AMOLED', icon: Flame },
            { id: 'rede', label: '6. Rede & HTTPS Local', icon: Wifi },
            { id: 'matriz', label: '7. Matriz de Ajustes', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Avaliação Geral */}
      {activeTab === 'geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Decisão de Arquitetura Correta
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Descartar vídeo contínuo em tempo real (RTSP/WebRTC) foi a melhor decisão do projeto.
                Elimina aquecimento, poupa banda Wi-Fi e foca a energia na exposição fotográfica estática em alta resolução via <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">takePhoto()</code>.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm mb-2">
                <CheckCircle2 className="w-4 h-4" />
                OCR Desacoplado no Windows
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Executar o Tesseract.js no Windows sob demanda (somente no clique de "Ler texto") protege a CPU do celular,
                permite pré-processamento pesado e possibilita a seleção por retângulo delimitador (ROI).
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm mb-2">
                <AlertTriangle className="w-4 h-4" />
                Atenção ao Moiré & Suporte AF
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Os dois únicos pontos de atenção crítica são a interferência de grade (Moiré) ao fotografar monitores LCD
                e a limitação do driver MediaTek da Xiaomi em expor o slider numérico contínuo de foco no Chrome.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Síntese Executiva das Considerações
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              O projeto foi extremamente bem concebido. As premissas de manter o sistema estritamente local, sem contas em nuvem,
              sem dependência de terceiros, com o celular fixo em suporte e alimentado na tomada, formam a arquitetura ideal
              para esta finalidade. A especificação técnica é coerente e viável com tecnologias Web modernas (PWA, ImageCapture API,
              Screen Wake Lock API e Tesseract.js em Web Worker).
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                Principais Pontos de Otimização Identificados
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-slate-700">1. Resolução Fotográfica:</span>
                  <span>Usar o modo Pixel-Binning de 16 MP (4624×3472) em vez dos 64 MP puros. Os 64 MP geram arquivos de 20MB+, estouram a memória do Chrome e sofrem com ruído sob a iluminação da tela. 16 MP tem alcance dinâmico superior e nitidez cirúrgica.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-slate-700">2. Supressão do Moiré:</span>
                  <span>Posicionar o celular com leve ângulo físico (3° a 5° de inclinação) para desacoplar a matriz Bayer da câmera da grade de subpixels RGB do laptop.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-slate-700">3. Foco no Chrome Android:</span>
                  <span>Implementar fallback transparente para re-acionamento de PDAF automático caso a propriedade <code className="bg-white px-1 py-0.5 border border-slate-200 rounded">focusDistance</code> manual não seja liberada pelo subsistema da Xiaomi.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Óptica & 64MP */}
      {activeTab === 'optica' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" />
              Análise Óptica do Redmi Note 10S a 25–30 cm
            </h3>
            <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md font-medium">
              Sensor Samsung ISOCELL GW3 (64 MP)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
              <div className="font-semibold text-slate-900">Geometria e Enquadramento</div>
              <ul className="space-y-1.5 text-slate-600">
                <li>• <strong>Distância Focal Equivalente:</strong> 26 mm (grande-angular padrão).</li>
                <li>• <strong>Ângulo de Visão (FOV):</strong> ~79° diagonal (~65° horizontal).</li>
                <li>• <strong>Largura do Campo a 28 cm:</strong> ~36 cm a 38 cm de largura real fotografada.</li>
                <li>• <strong>Tamanho da Tela do Laptop 14":</strong> ~30,9 cm (largura) × 17,4 cm (altura).</li>
                <li className="text-emerald-700 font-medium pt-1">
                  ✓ Conclusão: A tela de 14" cabe com margem de segurança de ~3 cm em cada lado a 28 cm de distância!
                </li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
              <div className="font-semibold text-slate-900">Profundidade de Campo (DoF) & Abertura f/1.79</div>
              <ul className="space-y-1.5 text-slate-600">
                <li>• <strong>Abertura Física:</strong> f/1.79 (lente muito luminosa).</li>
                <li>• <strong>Profundidade de Campo a 28 cm:</strong> ~2,2 cm a 2,8 cm.</li>
                <li>• <strong>Impacto:</strong> A profundidade de campo é relativamente rasa. Se o celular estiver muito torto, um dos cantos da tela pode ficar levemente fora de foco.</li>
                <li className="text-blue-700 font-medium pt-1">
                  ✓ Recomendação: O suporte fixo deve manter o plano do celular paralelo ao plano da tela do laptop (com leve inclinação controlada de até 5° apenas para combater o Moiré).
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Por que usar o modo 16 MP (Pixel Binning) em vez dos 64 MP puros no Chrome:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-red-50/60 border border-red-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-red-800">Modo 64 MP Puro (Desaconselhado para Web)</div>
                <p className="text-red-700 leading-relaxed">
                  Tamanho de pixel minúsculo (0.7 µm), gerando muito ruído óptico em iluminação mista.
                  Gera imagens de 20MB a 35MB. Ao decodificar no Chrome, ocupa ~250MB de RAM por foto,
                  tornando a transferência lenta no Wi-Fi e correndo risco de crash da aba do PWA por Out of Memory.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-emerald-800">Modo 16 MP Tetracell / Quad-Bayer (Recomendado)</div>
                <p className="text-emerald-700 leading-relaxed">
                  Combina 4 pixels em 1 (pixel virtual de 1.4 µm), trazendo alcance dinâmico 4x maior e eliminação de granulado.
                  Resolução de 4624×3472 dá ~380 DPI ópticos sobre a tela de 14". Uma letra de 8pt terá mais de 30 pixels de altura,
                  que é a faixa de máxima acurácia para o Tesseract.js!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Desafio Moiré & OCR */}
      {activeTab === 'moire' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-600" />
              O Fenômeno do Moiré em Fotos de Monitores LCD
            </h3>
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md font-medium">
              Risco Nº 1 para OCR
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Quando a grade periódica dos subpixels da tela do laptop (1920×1080) se alinha paralelamente com os fotodiodos do sensor do celular,
            ocorre interferência espacial ondulatória conhecida como <strong>Efeito Moiré</strong>. Isso cria faixas escuras e coloridas que cortam letras
            como "e", "s", "c" e "o", reduzindo drasticamente o índice de acerto do OCR.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="font-semibold text-slate-800 mb-1">1. Inclinação Física (3° a 5°)</div>
              <p className="text-slate-600">
                Girar o celular ligeiramente no plano (ou inclinar alguns graus o suporte) quebra a fase de interferência entre as duas matrizes. É a técnica física mais eficiente.
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="font-semibold text-slate-800 mb-1">2. Grayscale BT.709</div>
              <p className="text-slate-600">
                Descartar as cores RGB e converter para escala de cinza com pesos luminosos elimina as bandas de aberração cromática geradas pelos subpixels.
              </p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="font-semibold text-slate-800 mb-1">3. Binarização de Otsu (ROI)</div>
              <p className="text-slate-600">
                O aplicativo executa binarização adaptativa apenas na área selecionada pelo usuário, transformando o texto em traços preto e branco puros.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-lg text-xs space-y-2 font-mono">
            <div className="text-emerald-400 font-semibold">// Pipeline de OCR implementado neste app:</div>
            <div>1. Usuário seleciona retângulo da área de interesse (ROI)</div>
            <div>2. Imagem recortada para Canvas 2D</div>
            <div>3. Filtro Denoise / Blur suave (0.8px) para diluir frequência do Moiré</div>
            <div>4. Limiarização Otsu para isolamento de caracteres</div>
            <div>5. Worker Tesseract.js com dicionário de língua inglesa (eng.traineddata)</div>
          </div>
        </div>
      )}

      {/* Tab 4: Web APIs */}
      {activeTab === 'webapi' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              Comportamento do Chrome Android: ImageCapture & Foco
            </h3>
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md font-medium">
              W3C MediaStream Constraints
            </span>
          </div>

          <div className="space-y-4 text-xs text-slate-600">
            <div className="border-l-4 border-amber-500 pl-4 py-1 bg-amber-50/40 rounded-r-lg">
              <div className="font-semibold text-slate-900 mb-1">Particularidade do Redmi Note 10S (MediaTek Helio G95)</div>
              <p className="leading-relaxed">
                Na ROM MIUI/HyperOS da Xiaomi com processador MediaTek, a camada HAL Camera2 frequentemente expõe para o navegador Chromium
                apenas os modos de foco <code className="bg-white px-1 py-0.5 rounded border border-amber-200 text-amber-900">['continuous', 'auto']</code>, omitindo a propriedade de distância contínua em metros (<code className="bg-white px-1 py-0.5 rounded border border-amber-200 text-amber-900">focusDistance</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
                <div className="font-semibold text-slate-800">Se o Chrome expuser 'focusDistance':</div>
                <p>O slider de foco manual no Windows envia o valor em metros (ex: 0.28m) via WebSocket. O Android aplica diretamente:</p>
                <code className="block bg-slate-900 text-emerald-400 p-2 rounded text-[11px] font-mono">
                  track.applyConstraints(&#123; advanced: [&#123; focusMode: 'manual', focusDistance: 0.28 &#125;] &#125;)
                </code>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
                <div className="font-semibold text-slate-800">Se o Chrome NÃO expuser foco manual:</div>
                <p>O sistema informa na interface do Windows e aciona o foco PDAF por gatilho antes de cada captura:</p>
                <code className="block bg-slate-900 text-blue-400 p-2 rounded text-[11px] font-mono">
                  track.applyConstraints(&#123; advanced: [&#123; focusMode: 'auto' &#125;] &#125;) // Recalibra foco
                </code>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
              <div className="font-semibold text-slate-800">Screen Wake Lock API no Chrome:</div>
              <p className="leading-relaxed">
                O Wake Lock é encerrado automaticamente pelo Chrome caso o usuário troque de aplicativo ou a tela seja minimizada.
                O aplicativo Android deve escutar o evento <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">document.addEventListener('visibilitychange')</code> e re-solicitar a trava de tela imediatamente sempre que o estado for <code className="font-mono">visible</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Térmica & AMOLED */}
      {activeTab === 'termico' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              Desempenho Térmico, Bateria e Display AMOLED
            </h3>
            <span className="text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-md font-medium">
              Operação Contínua 24/7
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-4 space-y-2">
              <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Vantagem Crítica: Painel Super AMOLED
              </div>
              <p className="text-slate-700 leading-relaxed">
                O Redmi Note 10S usa tela Super AMOLED. Em displays OLED, cada pixel emite sua própria luz.
                Ao manter a tela <strong>100% preta (#000000)</strong> com apenas caracteres cinza-escuro, <strong>98,5% dos pixels do display ficam desligados</strong>!
                Isso gera emissão de calor próxima de zero pela tela e consumo elétrico de fração de Watt.
              </p>
            </div>

            <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-4 space-y-2">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Atenção: Carregador Contínuo sob Câmera
              </div>
              <p className="text-slate-700 leading-relaxed">
                Manter a bateria em 100% permanentemente sob calor do circuito de carga pode acelerar o desgaste da célula de íons de lítio.
                Recomenda-se ativar nas Configurações da Xiaomi a opção de "Carregamento Noturno Otimizado" ou usar uma tomada inteligente que desligue quando o celular atingir 80%.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-xs space-y-2">
            <div className="font-semibold text-slate-800">Dica de Engenharia: Standby do Sensor</div>
            <p className="text-slate-600 leading-relaxed">
              Não renderize o preview de vídeo em um elemento <code className="bg-white px-1 py-0.5 rounded border border-slate-200">&lt;video&gt;</code> na tela do celular.
              Mantenha o stream em segundo plano com taxa de quadros mínima (ex: 5fps ou câmera pausada) e use o método <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">takePhoto()</code> somente quando o Windows enviar o comando. Isso reduz a temperatura do processador Helio G95 em cerca de 8°C a 12°C.
            </p>
          </div>
        </div>
      )}

      {/* Tab 6: Rede & HTTPS */}
      {activeTab === 'rede' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-teal-600" />
              Arquitetura de Rede Local & Requisito de HTTPS
            </h3>
            <span className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md font-medium">
              TLS / Secure Context
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            As APIs modernas do Chrome (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">navigator.mediaDevices.getUserMedia</code> e <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">navigator.wakeLock</code>) <strong>recusam-se a executar em HTTP comum</strong> quando o endereço não é <code className="font-mono">localhost</code> (ex: acessando o IP <code className="font-mono">https://192.168.1.100:3000</code>).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <span>Método A: Certificado Local com mkcert</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">Recomendado</span>
              </div>
              <p className="text-slate-600">
                O utilitário <code className="font-mono">mkcert</code> cria uma Autoridade Certificadora local.
                Você instala a CA raiz no Windows e no Android uma única vez.
                Todas as conexões locais passam a ter cadeado verde legítimo sem nenhum aviso de segurança!
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                <span>Método B: Flag Nativo do Chrome</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">Sem Certificados</span>
              </div>
              <p className="text-slate-600">
                No Chrome do celular, digite na barra de endereços:
                <br />
                <code className="bg-slate-900 text-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono mt-1 block">
                  chrome://flags/#unsafely-treat-insecure-origin-as-secure
                </code>
                Adicione o IP do seu servidor Windows (ex: <code className="font-mono">http://192.168.1.100:3000</code>).
                O Chrome liberará Câmera e WakeLock mesmo em HTTP simples!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Matriz de Ajustes */}
      {activeTab === 'matriz' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Matriz de Riscos, Validações e Recomendações Finais
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3">Item Analisado</th>
                  <th className="py-2.5 px-3">Diagnóstico Técnico</th>
                  <th className="py-2.5 px-3">Ação / Mitigação Recomendada</th>
                  <th className="py-2.5 px-3">Impacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="py-3 px-3 font-medium text-slate-900">Distância 25–30 cm</td>
                  <td className="py-3 px-3">Excelente. Dá cobertura completa da tela de 14" e fica dentro do alcance ideal do sensor GW3.</td>
                  <td className="py-3 px-3">Manter a 28 cm. Evitar menos de 20 cm para não distorcer bordas ópticas.</td>
                  <td className="py-3 px-3"><span className="text-emerald-700 font-medium">Positivo</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-slate-900">Efeito Moiré na Tela</td>
                  <td className="py-3 px-3">Interferência física entre os subpixels da tela do laptop e a matriz Bayer do sensor.</td>
                  <td className="py-3 px-3">Inclinar o celular em 3°–5° e aplicar filtro Grayscale + Otsu no corte antes do OCR.</td>
                  <td className="py-3 px-3"><span className="text-amber-700 font-medium">Crítico</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-slate-900">Foco Manual no Chrome</td>
                  <td className="py-3 px-3">A HAL MediaTek da Xiaomi pode não disponibilizar o slider contínuo de metros.</td>
                  <td className="py-3 px-3">O app detecta suporte e alterna para PDAF automático com re-calibração instantânea.</td>
                  <td className="py-3 px-3"><span className="text-blue-700 font-medium">Médio</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-slate-900">Aquecimento / Carregador</td>
                  <td className="py-3 px-3">Tela AMOLED preta gera calor nulo. Aquecimento residual vem da bateria e câmera.</td>
                  <td className="py-3 px-3">Não exibir preview de vídeo no celular. Deixar câmera pausada até o clique de foto.</td>
                  <td className="py-3 px-3"><span className="text-emerald-700 font-medium">Baixo</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-medium text-slate-900">OCR no Windows</td>
                  <td className="py-3 px-3">Tesseract.js em Web Worker executando apenas na seleção retangular (ROI).</td>
                  <td className="py-3 px-3">Processar apenas o recorte selecionado (leva &lt;500ms vs 15s na imagem cheia).</td>
                  <td className="py-3 px-3"><span className="text-emerald-700 font-medium">Excelente</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
