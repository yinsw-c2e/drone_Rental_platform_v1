type Fact = {
  label: string
  value: string
}

type Role = {
  name: string
  summary: string
  detail: string
}

type Capability = {
  title: string
  description: string
}

type AuditPoint = {
  title: string
  value: string
}

type PreviewCard = {
  title: string
  label: string
  lines: string[]
}

type DemoAccount = {
  role: string
  phone: string
  useCase: string
}

type DocumentSection = {
  title: string
  intro: string
  points: string[]
}

type ValueCard = {
  title: string
  description: string
}

type SupportCard = {
  title: string
  description: string
  bullets: string[]
}

type FaqItem = {
  question: string
  answer: string
}

const appFacts: Fact[] = [
  {label: '应用名称', value: '无人机服务'},
  {label: '应用描述', value: '面向装卸搬运场景的无人机服务平台。'},
  {label: '应用类目', value: '物流服务 - 装卸搬运'},
  {label: '页面内容', value: '应用介绍、运行流程、下载体验、隐私政策与用户协议。'},
]

const roles: Role[] = [
  {
    name: '客户 / 企业客户',
    summary: '发布需求、下单支付、查看订单进度与完成验收。',
    detail: '适用于需要运输、吊运或装卸搬运服务的个人与企业客户。',
  },
  {
    name: '机主',
    summary: '维护无人机资产、发布供给、承接订单并安排执行。',
    detail: '负责设备管理、供给上架、报价响应与设备侧履约。',
  },
  {
    name: '飞手',
    summary: '接收派单、执行飞行任务、回传轨迹与飞行记录。',
    detail: '负责现场执行、飞前检查、飞行过程留痕与任务完成反馈。',
  },
  {
    name: '复合身份',
    summary: '适用于个体经营者，可同时拥有机主与飞手能力。',
    detail: '支持自有设备承接服务，并由本人完成派单执行与交付。',
  },
]

const capabilities: Capability[] = [
  {
    title: '需求发布与供给上架',
    description: '客户发布装卸搬运需求，机主发布无人机服务供给，平台统一管理服务范围、时间、地点与预算。',
  },
  {
    title: '在线沟通与报价撮合',
    description: '围绕服务内容、执行时间和现场条件进行在线沟通，完成供需双方的报价和确认。',
  },
  {
    title: '订单创建与支付',
    description: '当方案确认后生成正式订单，平台记录订单状态、支付进度和服务约束条件。',
  },
  {
    title: '派单与资源匹配',
    description: '平台支持机主指派飞手执行任务，或由复合身份用户直接承接并自行执行。',
  },
  {
    title: '飞行执行与监控',
    description: '飞手执行任务过程中记录轨迹、状态和关键节点，形成可回溯的履约留痕。',
  },
  {
    title: '验收、结算与评价',
    description: '客户完成验收后进入结算阶段，平台支持订单收尾、评价反馈与后续服务跟进。',
  },
]

const auditPoints: AuditPoint[] = [
  {title: '产品名称', value: '无人机服务'},
  {title: '服务场景', value: '物流服务 - 装卸搬运与重载吊运'},
  {title: '角色体系', value: '客户、机主、飞手与复合身份协同'},
  {title: '页面内容', value: '产品介绍、流程说明、下载体验与政策信息'},
]

const scenarios = [
  '电力电网建设物资吊运',
  '山区竹木与农副产品转运',
  '高原与海岛补给运输',
  '应急救援物资吊运',
]

const heroStats = [
  {value: '3', label: '核心角色'},
  {value: '5', label: '关键对象'},
  {value: '1', label: '完整履约链路'},
]

const valueCards: ValueCard[] = [
  {
    title: '多角色协同',
    description: '围绕客户、机主、飞手与复合身份设计产品结构，适配从需求发起到现场执行的业务协作。',
  },
  {
    title: '流程可追踪',
    description: '从需求、供给、订单、派单到飞行记录形成结构化留痕，便于查看状态与回溯过程。',
  },
  {
    title: '场景聚焦清晰',
    description: '聚焦装卸搬运与重载末端货物吊运，不向通用航拍、同城配送等非目标场景扩散。',
  },
]

const previewCards: PreviewCard[] = [
  {
    title: '综合首页',
    label: '客户 / 机主 / 飞手',
    lines: ['查看平台概览', '切换业务入口', '快速进入供给、需求、订单与消息'],
  },
  {
    title: '派单执行',
    label: '正式履约流程',
    lines: ['确认执行人', '记录飞前检查', '回传飞行状态与完成结果'],
  },
  {
    title: '订单验收',
    label: '客户闭环',
    lines: ['查看订单进度', '完成验收评价', '进入结算与售后跟踪'],
  },
]

const demoAccounts: DemoAccount[] = [
  {role: '客户', phone: '13800000004', useCase: '供给市场浏览、创建需求、支付与验收'},
  {role: '机主', phone: '13800000007', useCase: '无人机管理、供给发布、报价与订单承接'},
  {role: '飞手', phone: '13900000016', useCase: '候选报名、正式派单、飞行记录与履约执行'},
  {role: '复合身份', phone: '13800000002', useCase: '综合首页、双角色入口与复合身份验证'},
]

const supportCards: SupportCard[] = [
  {
    title: '业务场景咨询',
    description: '适用于装卸搬运、重载吊运、末端运输等需要多角色协同的无人机服务场景。',
    bullets: ['适合需求方快速了解产品边界', '支持围绕服务流程与角色能力进行沟通'],
  },
  {
    title: '应用体验支持',
    description: '当前已提供 Android 下载入口和体验账号，可用于了解主要页面结构与业务链路。',
    bullets: ['下载入口集中展示在官网内', '建议按客户、机主、飞手视角依次体验'],
  },
  {
    title: '合作对象',
    description: '适合客户、机主、飞手以及项目合作方了解产品定位、使用方式和服务组织形式。',
    bullets: ['客户侧关注需求、订单与验收', '供给侧关注设备、派单、飞行记录与履约'],
  },
]

const faqItems: FaqItem[] = [
  {
    question: '这个应用主要适用于哪些业务场景？',
    answer: '当前产品重点面向物流服务 - 装卸搬运与重载末端货物吊运场景，涵盖物资吊运、山区转运、应急运输等业务。',
  },
  {
    question: '应用支持哪些角色使用？',
    answer: '支持客户、机主、飞手三类主要角色，也支持机主与飞手能力兼备的复合身份用户。',
  },
  {
    question: '如何快速了解产品流程？',
    answer: '可先查看官网中的运行流程图，再通过下载入口安装应用，并结合体验账号按角色顺序了解功能。',
  },
  {
    question: '官网可以看到哪些信息？',
    answer: '页面提供产品概览、核心能力、运行流程、典型页面示意、下载体验、隐私政策与用户协议等内容。',
  },
]

const privacySections: DocumentSection[] = [
  {
    title: '1. 收集的信息',
    intro: '为完成账号注册、订单履约和飞行服务管理，本应用可能在用户授权后收集以下信息。',
    points: [
      '账号与身份信息：手机号、昵称、实名资料、角色档案与认证信息。',
      '设备与日志信息：设备型号、系统版本、应用版本、登录日志与异常日志。',
      '定位与轨迹信息：在您授权定位权限后，用于推荐附近服务、任务执行与飞行留痕。',
      '业务数据：需求、供给、订单、派单、支付、评价与飞行记录等与服务履约直接相关的信息。',
    ],
  },
  {
    title: '2. 信息使用方式',
    intro: '我们仅在实现应用核心功能所需的合理范围内使用个人信息。',
    points: [
      '用于账号注册、登录验证、身份识别和角色能力开通。',
      '用于供需撮合、派单执行、订单管理、验收结算与售后支持。',
      '用于保障交易安全、风控审计、异常排查和服务稳定性优化。',
      '用于向您展示与当前业务相关的通知、进度提醒和系统公告。',
    ],
  },
  {
    title: '3. 信息共享与披露',
    intro: '除法律法规要求或履约必要场景外，我们不会擅自对外披露您的个人信息。',
    points: [
      '在订单履约过程中，平台会向相关服务方展示必要的联系人、订单与执行信息。',
      '当法律法规、监管机构或司法机关要求提供时，我们将依法配合。',
      '涉及第三方服务能力时，仅在完成功能所需的最小范围内共享必要信息。',
    ],
  },
  {
    title: '4. 信息存储与保护',
    intro: '我们会采取合理的技术与管理措施保护用户信息安全。',
    points: [
      '采用权限控制、身份校验、日志审计等方式降低信息泄露风险。',
      '对敏感信息进行严格访问控制，仅授权相关业务流程使用。',
      '当不再需要相关信息时，我们将依据业务需要和法律要求进行删除或匿名化处理。',
    ],
  },
  {
    title: '5. 用户权利',
    intro: '您可以在应用内或通过平台支持渠道行使与个人信息相关的权利。',
    points: [
      '查询、修改或补充您的账号资料、联系人信息与角色档案。',
      '关闭非必要授权，或申请删除测试环境下的演示数据。',
      '对隐私政策内容有疑问时，可通过应用官网与体验支持渠道获取说明。',
    ],
  },
  {
    title: '6. 政策更新',
    intro: '当业务功能或法律要求发生变化时，本隐私政策可能更新。',
    points: [
      '重大变更将通过官网页面或应用内通知进行提示。',
      '更新后的政策自发布之日起生效，继续使用本应用即视为您已知悉相关调整。',
    ],
  },
]

const agreementSections: DocumentSection[] = [
  {
    title: '1. 服务定位',
    intro: '“无人机服务”是面向装卸搬运与重载末端货物吊运场景的移动应用服务平台。',
    points: [
      '平台主要连接客户、机主和飞手，围绕需求、供给、订单、派单和飞行记录形成业务闭环。',
      '用户应基于真实、合法、合规的业务场景使用本应用，不得用于违法违规用途。',
    ],
  },
  {
    title: '2. 账号与认证',
    intro: '用户注册、登录和角色开通应保证信息真实、准确、完整。',
    points: [
      '账号仅限本人或所在组织授权使用，不得出借、转让或冒用他人身份。',
      '机主与飞手在使用相关功能前，应按平台要求完成必要认证与资质补充。',
    ],
  },
  {
    title: '3. 发布与履约规则',
    intro: '平台支持需求发布、供给上架、报价沟通、订单创建与派单执行。',
    points: [
      '客户应确保发布信息真实有效，明确服务范围、时间、地点与联系人。',
      '机主与飞手应按照约定履行订单、执行任务，并保持沟通通畅。',
      '任何一方不得发布虚假信息、恶意报价、恶意接单或干扰正常交易秩序。',
    ],
  },
  {
    title: '4. 支付与结算',
    intro: '订单支付、验收与结算应按照应用内展示的流程与状态进行。',
    points: [
      '客户完成订单确认后可进入支付环节，具体支付方式以应用内实际支持为准。',
      '服务完成并经验收后进入结算流程，平台记录相关订单与结算状态。',
      '如出现争议，平台可基于订单记录、飞行留痕和沟通信息协助核验。',
    ],
  },
  {
    title: '5. 平台规则与责任',
    intro: '平台负责提供信息展示、流程管理和基础技术支撑，但不替代用户应承担的法定义务。',
    points: [
      '用户应自行确保业务活动、设备资质、飞行执行与现场操作符合相关法律法规。',
      '因虚假信息、违规操作、超范围使用或第三方原因造成的损失，应由责任方承担相应责任。',
    ],
  },
  {
    title: '6. 协议变更与终止',
    intro: '平台可根据业务发展、法规要求和安全需要对协议内容进行调整。',
    points: [
      '协议更新后将通过官网或应用内通知告知用户。',
      '若用户不同意更新内容，可停止使用本应用相关服务；继续使用视为接受更新后的协议。',
    ],
  },
]

export default function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container site-nav">
          <a className="brand" href="#top">
            <img className="brand-icon" src="/app-icon.png" alt="无人机服务应用图标" />
            <div className="brand-copy">
              <strong>无人机服务</strong>
              <span>移动应用官网</span>
            </div>
          </a>

          <nav className="nav-links" aria-label="主导航">
            <a href="#overview">产品概览</a>
            <a href="#capabilities">核心能力</a>
            <a href="#flow">运行流程</a>
            <a href="#experience">下载体验</a>
            <a href="#privacy">隐私政策</a>
            <a href="#terms">用户协议</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">装卸搬运与重载吊运场景移动应用</span>
              <h1>无人机服务</h1>
              <p className="hero-lead">
                面向物流服务与装卸搬运场景的无人机服务平台，覆盖客户发布需求、机主上架供给、飞手执行任务、
                订单派单、飞行留痕与验收结算的完整业务链路。
              </p>

              <div className="hero-actions">
                <a className="primary-link" href="#overview">
                  查看应用介绍
                </a>
                <a
                  className="secondary-link"
                  href="https://www.pgyer.com/wurenjimobile"
                  target="_blank"
                  rel="noreferrer"
                >
                  下载 Android 体验包
                </a>
              </div>

              <div className="hero-stats" aria-label="平台概览">
                {heroStats.map(item => (
                  <div className="hero-stat" key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="hero-pills" aria-label="应用关键词">
                <span>客户 / 机主 / 飞手</span>
                <span>物流服务 - 装卸搬运</span>
                <span>订单 / 派单 / 飞行记录</span>
              </div>
            </div>

            <div className="hero-panel">
              <div className="hero-panel-top">
                <img className="hero-app-icon" src="/app-icon.png" alt="无人机服务图标" />
                <div>
                  <p className="hero-panel-label">产品核心信息</p>
                  <h2>快速了解应用定位与服务内容</h2>
                </div>
              </div>

              <div className="fact-list">
                {appFacts.map(item => (
                  <div className="fact-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="scenario-block">
                <p>主要业务场景</p>
                <div className="scenario-list">
                  {scenarios.map(item => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container audit-strip">
            {auditPoints.map(item => (
              <div className="audit-card" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">平台价值</span>
              <h2>围绕真实履约链路组织产品能力</h2>
              <p>官网呈现的不只是功能列表，更强调角色协作、场景聚焦和全过程可追踪的服务结构。</p>
            </div>

            <div className="value-grid">
              {valueCards.map(item => (
                <article className="value-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="overview">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">产品概览</span>
              <h2>面向装卸搬运场景的无人机服务平台</h2>
              <p>
                无人机服务以“需求发布、供给上架、订单创建、派单执行、飞行留痕、验收结算”为主线，
                服务于需要无人机参与装卸搬运与吊运协作的业务场景。
              </p>
            </div>

            <div className="overview-grid">
              <article className="panel-card">
                <h3>产品定位</h3>
                <p>
                  “无人机服务”聚焦物流服务 - 装卸搬运与重载末端货物吊运场景，不面向通用航拍或城市即时配送，
                  重点支持供需撮合、订单管理、任务执行和履约留痕。
                </p>
              </article>

              <article className="panel-card">
                <h3>核心对象</h3>
                <ul className="info-list">
                  <li>需求：客户提出的服务请求</li>
                  <li>供给：机主可提供的无人机服务能力</li>
                  <li>订单：供需确认后的正式履约合同</li>
                  <li>派单：订单进入执行阶段后的任务指令</li>
                  <li>飞行记录：履约过程中的轨迹与状态留痕</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">角色体系</span>
              <h2>围绕客户、机主、飞手构建多角色业务协同</h2>
              <p>应用支持默认客户身份和扩展角色能力，兼容个人与组织在不同场景下的协作与履约。</p>
            </div>

            <div className="role-grid">
              {roles.map(role => (
                <article className="role-card" key={role.name}>
                  <span className="role-pill">{role.name}</span>
                  <h3>{role.summary}</h3>
                  <p>{role.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="capabilities">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">核心能力</span>
              <h2>从需求发布到验收结算，覆盖完整履约链路</h2>
              <p>平台围绕供需两端、订单执行和飞行留痕提供可追踪的数字化流程。</p>
            </div>

            <div className="capability-grid">
              {capabilities.map(item => (
                <article className="capability-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="flow">
          <div className="container section-surface flow-layout">
            <div className="section-heading flow-heading">
              <span className="section-tag">运行流程</span>
              <h2>移动端业务流程图</h2>
              <p>
                当前应用围绕“登录认证 - 市场浏览 - 沟通报价 - 订单支付 - 派单执行 - 飞行监管 - 验收结算”形成完整业务闭环。
              </p>
            </div>

            <div className="flow-grid">
              <div className="flow-image-wrap">
                <img src="/operation-flow.png" alt="无人机服务移动端应用运行流程图" />
              </div>

              <div className="flow-summary">
                <h3>流程要点</h3>
                <ul className="info-list">
                  <li>客户通过首页与市场入口浏览供给并发布运输或吊运需求。</li>
                  <li>机主维护无人机资产并响应市场需求，完成报价与服务确认。</li>
                  <li>飞手接受派单后执行飞行任务，平台记录轨迹、状态与完成结果。</li>
                  <li>客户确认验收后进入结算阶段，形成订单闭环与评价记录。</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">界面示意</span>
              <h2>移动端核心页面布局预览</h2>
              <p>以下示意用于说明产品结构与典型交互场景，实际功能以移动应用为准。</p>
            </div>

            <div className="preview-grid">
              {previewCards.map(card => (
                <article className="preview-card" key={card.title}>
                  <div className="preview-top">
                    <span>{card.label}</span>
                    <strong>{card.title}</strong>
                  </div>
                  <div className="phone-demo">
                    <div className="phone-demo-notch" />
                    <div className="phone-demo-content">
                      <div className="phone-demo-banner">
                        <p>无人机服务</p>
                        <span>{card.title}</span>
                      </div>
                      <div className="phone-demo-list">
                        {card.lines.map(line => (
                          <div className="phone-demo-row" key={line}>
                            <span className="dot" />
                            <p>{line}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="experience">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">下载体验</span>
              <h2>提供下载入口与体验账号</h2>
              <p>可通过 Android 安装包和测试账号进入移动应用环境，了解主要功能与业务流程。</p>
            </div>

            <div className="experience-grid">
              <article className="experience-card emphasis-card">
                <span className="card-kicker">体验入口</span>
                <h3>Android 下载入口</h3>
                <p>当前 Android 安装包已通过蒲公英提供下载，方便体验主要业务流程与页面功能。</p>
                <a
                  className="primary-link"
                  href="https://www.pgyer.com/wurenjimobile"
                  target="_blank"
                  rel="noreferrer"
                >
                  前往下载页
                </a>
                <div className="support-note">
                  <strong>下载提示</strong>
                  <p>安装包用于体验应用主要流程，建议结合页面说明了解产品角色与服务场景。</p>
                </div>
              </article>

              <article className="experience-card">
                <span className="card-kicker">体验账号</span>
                <h3>推荐测试账号</h3>
                <div className="demo-list">
                  {demoAccounts.map(account => (
                    <div className="demo-item" key={account.role}>
                      <div>
                        <strong>{account.role}</strong>
                        <span>{account.phone}</span>
                      </div>
                      <p>{account.useCase}</p>
                    </div>
                  ))}
                </div>
                <p className="demo-footnote">体验建议：可按“客户 → 机主 → 飞手 → 复合身份”顺序了解不同角色能力。</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">合作与支持</span>
              <h2>帮助不同角色快速理解如何接入和体验产品</h2>
              <p>无论是希望发布需求、提供设备服务，还是参与飞行执行，都可以先从页面中的角色说明和体验入口开始了解。</p>
            </div>

            <div className="support-grid">
              {supportCards.map(card => (
                <article className="support-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <ul className="info-list">
                    {card.bullets.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container section-surface faq-surface">
            <div className="section-heading">
              <span className="section-tag">常见问题</span>
              <h2>关于应用定位和体验方式的快速说明</h2>
              <p>如果你是首次了解无人机服务，可以从下面这些问题快速建立整体认知。</p>
            </div>

            <div className="faq-grid">
              {faqItems.map(item => (
                <article className="faq-card" key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">隐私政策</span>
              <h2>我们如何收集、使用与保护用户信息</h2>
              <p>以下内容用于说明“无人机服务”在账号注册、订单履约和飞行任务管理过程中的信息处理方式。</p>
            </div>

            <div className="document-grid">
              {privacySections.map(section => (
                <article className="document-card" key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.intro}</p>
                  <ul className="info-list">
                    {section.points.map(point => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="terms">
          <div className="container section-surface">
            <div className="section-heading">
              <span className="section-tag">用户协议</span>
              <h2>围绕账号使用、交易流程和履约行为的基础规则</h2>
              <p>用户访问或使用“无人机服务”应用，即表示同意按照以下协议条款使用平台提供的服务。</p>
            </div>

            <div className="document-grid">
              {agreementSections.map(section => (
                <article className="document-card" key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.intro}</p>
                  <ul className="info-list">
                    {section.points.map(point => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <span className="footer-tag">无人机服务官网</span>
            <p>
              当前页面用于展示无人机服务的产品定位、业务流程、下载体验与基础政策内容，
              方便访客快速建立对应用能力和服务场景的整体认识。
            </p>
          </div>

          <div className="footer-links">
            <a href="#overview">产品概览</a>
            <a href="#flow">运行流程</a>
            <a href="#experience">下载体验</a>
            <a href="#privacy">隐私政策</a>
            <a href="#terms">用户协议</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
