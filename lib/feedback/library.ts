// 360 Feedback — default competency library and configuration.
// Transcribed from the prototype. Admin can edit/add/remove competencies later;
// this only provides the initial seed (loaded lazily on first use).

export type Category = "CORE" | "LEADERSHIP" | "JOB_FAMILY" | "TECHNICAL";

export interface SeedCompetency {
  code: string;
  name: string;
  category: Category;
  department: string | null; // for JOB_FAMILY / TECHNICAL; null = all departments
  definition: string;
  levels: [string, string, string, string]; // L1..L4 anchors
}

export const DEPARTMENTS = ["Tech", "Commercial", "Operations", "Executive"];

export const LEVELS = [
  "Internship",
  "Part Time",
  "Officer",
  "Sr Officer",
  "Leader",
  "Manager",
  "Vice President",
  "C-Suites",
  "Direktur",
];

export const DEFAULT_LEVEL_TARGETS: Record<string, number> = {
  Internship: 1,
  "Part Time": 1,
  Officer: 1,
  "Sr Officer": 2,
  Leader: 2,
  Manager: 2,
  "Vice President": 3,
  "C-Suites": 4,
  Direktur: 4,
};

export const DEFAULT_WEIGHTS = { super: 0.4, peer: 0.3, sub: 0.3 };

// Bands evaluated in order: first band whose `max` is greater than the score wins.
export type Band = {
  key: string;
  label: string;
  max: number; // upper bound (exclusive); last band uses a large number
  color: string; // tailwind-ish token used in UI
};
export const DEFAULT_BANDS: Band[] = [
  { key: "unsat", label: "Unsatisfactory", max: 2, color: "red" },
  { key: "need", label: "Need Improvement", max: 3, color: "amber" },
  { key: "meet", label: "Meet Expectation", max: 3.5001, color: "teal" },
  { key: "exceed", label: "Exceed Expectation", max: 9999, color: "green" },
];

// 1-4 rating scale shown on the form.
export const SCALE: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "Unsatisfactory", hint: "Does not meet the standard / competency not yet visible" },
  { value: 2, label: "Need Improvement", hint: "Partially meets the standard; still needs development" },
  { value: 3, label: "Meet Expectation", hint: "Meets the expected standard" },
  { value: 4, label: "Exceed Expectation", hint: "Consistently exceeds the standard" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  CORE: "Core",
  LEADERSHIP: "Leadership",
  JOB_FAMILY: "Job Family",
  TECHNICAL: "Technical",
};

export const RELATION_LABEL: Record<string, string> = {
  SELF: "Self",
  PEER: "Peer",
  SUPERORDINATE: "Superordinate",
  SUBORDINATE: "Subordinate",
};

const GENERIC: [string, string, string, string] = [
  "Basic — executes simple tasks with guidance",
  "Applied — works independently on routine cases",
  "Professional — handles complex cases & advises others",
  "Strategic — sets standards & drives systemic improvement",
];

export const COMPETENCY_LIBRARY: SeedCompetency[] = [
  // ---------- CORE ----------
  { code: "INT", name: "Initiative", category: "CORE", department: null,
    definition: "Measures initiative — acting quickly on problems/opportunities without waiting for instructions, and generating improvement ideas.",
    levels: ["Resolves daily problems without waiting for orders", "Fast & effective response in a crisis (1–2 days)", "Anticipates opportunities/obstacles 1–3 months ahead", "Innovative long-term transformation of work systems"] },
  { code: "SCF", name: "Self-Confidence", category: "CORE", department: null,
    definition: "Balanced self-confidence — decisive in making decisions while staying open to criticism & continuously learning.",
    levels: ["Operational independence & personal accountability", "Resilient to criticism without being defensive", "Capacity integrity — dares to underpromise for quality", "Intellectual humility & continuous growth"] },
  { code: "ACH", name: "Achievement Orientation", category: "CORE", department: null,
    definition: "Drive to achieve — working to high standards & delivering results beyond expectations.",
    levels: ["Quality focus (zero defect)", "Resource & process optimization", "Self-set targets that exceed expectations (overdeliver)", "Continuous systemic improvement"] },
  { code: "OC", name: "Organizational Commitment", category: "CORE", department: null,
    definition: "Commitment to the organization — aligning actions with company goals & values.",
    levels: ["Active compliance with rules & values", "Priority alignment with the team", "Value advisor & culture role model", "Strategic sacrifice for the company"] },
  { code: "FLX", name: "Flexibility", category: "CORE", department: null,
    definition: "Flexibility — adapting to change & valuing different opinions.",
    levels: ["Adapts tasks when instructions change", "Openness to different perspectives", "Modifies strategy for complex situations", "Catalyst for organizational change"] },
  { code: "TW", name: "Teamwork & Cooperation", category: "CORE", department: null,
    definition: "Teamwork — sharing information, supporting colleagues, and contributing to the group.",
    levels: ["Cooperative participation & information sharing", "Active support for colleagues", "Cross-functional collaboration", "Team empowerment & synergy"] },
  { code: "CSO", name: "Customer Service Orientation", category: "CORE", department: null,
    definition: "Service orientation — the desire to help customers/colleagues through to completion.",
    levels: ["Responsive & attentive per SLA", "Thorough problem solver", "Trusted long-term advisor", "Client-centric visionary"] },

  // ---------- LEADERSHIP ----------
  { code: "CT", name: "Conceptual Thinking", category: "LEADERSHIP", department: null,
    definition: "Strategic thinking — understanding the business, market & numbers to make profitable decisions.",
    levels: ["Understands the business model & team contribution", "Simple market trend analysis", "Division strategy from financial/competitor data", "Business vision & new revenue models"] },
  { code: "DEV", name: "Developing Others", category: "LEADERSHIP", department: null,
    definition: "Developing others — coaching, giving feedback & preparing successors.",
    levels: ["Clear instructions & help with daily tasks", "Regular feedback & mentoring", "Team career plans & successors", "Learning culture & producing new leaders"] },
  { code: "IMP", name: "Impact & Influence", category: "LEADERSHIP", department: null,
    definition: "Influence — motivating others to accept & execute change.",
    levels: ["Accepts & communicates change", "Helps the team adapt to transitions", "Implementation strategy & overcoming resistance", "Agent of culture/business-model change"] },
  { code: "DIR", name: "Directiveness", category: "LEADERSHIP", department: null,
    definition: "Assertiveness — setting boundaries, making firm decisions & using authority appropriately.",
    levels: ["Clear daily decisions/instructions", "Independent decisions under urgency", "Strict standards & tough decisions", "Strategic decisions on new company direction"] },

  // ---------- JOB FAMILY ----------
  { code: "AT", name: "Analytical Thinking", category: "JOB_FAMILY", department: "Tech",
    definition: "Analytical thinking — breaking technical problems into logical parts & seeing cause-and-effect.",
    levels: ["Breaks down tasks & basic If-Then logic", "Analyzes relationships between modules/APIs", "Multidimensional analysis & bottleneck prediction", "Strategic architecture & scalability"] },
  { code: "EXP", name: "Technical Expertise", category: "JOB_FAMILY", department: "Tech",
    definition: "Depth of technical expertise in a specific field (e.g. coding, design, PM).",
    levels: ["Mastery of basic tools", "Independent practitioner", "Technical reference (code review/audit)", "Field authority & company standards"] },
  { code: "INF", name: "Information Seeking", category: "JOB_FAMILY", department: "Commercial",
    definition: "Information seeking — digging deeper into data before acting/deciding.",
    levels: ["Standard information gathering", "Deep investigation beyond formal sources", "Field research & verification", "Strategic intelligence system"] },
  { code: "IU", name: "Interpersonal Understanding", category: "JOB_FAMILY", department: "Commercial",
    definition: "Interpersonal sensitivity — understanding others' often-unspoken feelings/intentions.",
    levels: ["Grasps explicit messages", "Reads body language & emotions", "Understands hidden motives", "Understands complexity of character & culture"] },
  { code: "RB", name: "Relationship Building", category: "JOB_FAMILY", department: "Commercial",
    definition: "Building & maintaining a network of relationships that supports work outcomes.",
    levels: ["Establishes basic contacts", "Builds informal rapport", "Active network maintenance", "Strategic friendships (advocates)"] },
  { code: "CO", name: "Concern for Order", category: "JOB_FAMILY", department: "Operations",
    definition: "Accuracy & orderliness — maintaining data accuracy, compliance, and tidiness.",
    levels: ["Independent checking (data accuracy)", "Accuracy monitoring & reconciliation", "Builds control systems (QA/audit)", "Risk governance"] },
  { code: "OA", name: "Organizational Awareness", category: "JOB_FAMILY", department: "Operations",
    definition: "Organizational awareness — understanding structure, culture & office 'politics'.",
    levels: ["Understands the formal structure", "Understands informal structure/influencers", "Understands the organizational climate", "Strategic industry navigation"] },
  { code: "SCT", name: "Self-Control", category: "JOB_FAMILY", department: "Operations",
    definition: "Self-control — staying calm & effective under pressure or conflict.",
    levels: ["Stays calm when busy", "Restrains impulsivity during conflict", "High stress management during a crisis", "Cultural anchor during transitions"] },

  // ---------- TECHNICAL ----------
  { code: "AIF", name: "AI Fluency", category: "TECHNICAL", department: null,
    definition: "AI fluency — the ability & willingness to use, develop, and share AI applications at work.", levels: GENERIC },
  // Tech
  { code: "FEL", name: "Frontend Engineering & Logic", category: "TECHNICAL", department: "Tech", definition: "Frontend — building responsive interfaces with efficient state management.", levels: GENERIC },
  { code: "BSA", name: "Backend System Architecture", category: "TECHNICAL", department: "Tech", definition: "Backend — designing stable server logic, APIs & system flows.", levels: GENERIC },
  { code: "DBM", name: "Database Management", category: "TECHNICAL", department: "Tech", definition: "Database — maintaining & optimizing data storage structures.", levels: GENERIC },
  { code: "UXD", name: "User Experience (UX) Design", category: "TECHNICAL", department: "Tech", definition: "UX — designing intuitive user experiences through research & user journeys.", levels: GENERIC },
  { code: "UID", name: "Interface Design (UI)", category: "TECHNICAL", department: "Tech", definition: "UI — creating product visuals that are aesthetic, consistent & functional.", levels: GENERIC },
  { code: "DAR", name: "Design Architecture", category: "TECHNICAL", department: "Tech", definition: "Design architecture — building systematic & scalable design structures.", levels: GENERIC },
  { code: "PDV", name: "Product Discovery & Validation", category: "TECHNICAL", department: "Tech", definition: "Product discovery — finding user problems & validating solutions before building.", levels: GENERIC },
  { code: "POP", name: "Product Operations", category: "TECHNICAL", department: "Tech", definition: "Product operations — managing the backlog, documentation & product release flow.", levels: GENERIC },
  { code: "PSA", name: "Product Strategy & Analytics", category: "TECHNICAL", department: "Tech", definition: "Product strategy & analytics — turning product data into a business-impact roadmap.", levels: GENERIC },
  { code: "PPS", name: "Project Planning & Scheduling", category: "TECHNICAL", department: "Tech", definition: "Project planning — building schedules, sprints & resource allocation.", levels: GENERIC },
  { code: "PGV", name: "Project Governance", category: "TECHNICAL", department: "Tech", definition: "Project governance — setting standards, controls & project success reporting.", levels: GENERIC },
  { code: "AND", name: "Android Native Development", category: "TECHNICAL", department: "Tech", definition: "Android native — building high-performance mobile applications.", levels: GENERIC },
  { code: "MSI", name: "Mobile System Integration", category: "TECHNICAL", department: "Tech", definition: "Mobile system integration — connecting apps with backends & third-party services.", levels: GENERIC },
  { code: "QAT", name: "Quality Assurance & Testing", category: "TECHNICAL", department: "Tech", definition: "QA & testing — designing & executing test scenarios to guarantee quality.", levels: GENERIC },
  { code: "DBG", name: "Systematic Debugging", category: "TECHNICAL", department: "Tech", definition: "Systematic debugging — tracing & finding the root cause of technical problems.", levels: GENERIC },
  { code: "DOI", name: "DevOps & Infrastructure", category: "TECHNICAL", department: "Tech", definition: "DevOps & infrastructure — managing CI/CD & supporting infrastructure.", levels: GENERIC },
  { code: "COR", name: "Cloud Operations & Reliability", category: "TECHNICAL", department: "Tech", definition: "Cloud reliability — maintaining system availability & performance in the cloud.", levels: GENERIC },
  // Commercial
  { code: "CLC", name: "Commercial Law & Contracting", category: "TECHNICAL", department: "Commercial", definition: "Commercial law — understanding & applying legal aspects of contracts for risk mitigation.", levels: GENERIC },
  { code: "CSP", name: "Commercial Software Proficiency", category: "TECHNICAL", department: "Commercial", definition: "Proficiency in commercial software (CRM/ERP/sales tools) for efficiency & data accuracy.", levels: GENERIC },
  { code: "CSL", name: "Consultative Selling", category: "TECHNICAL", department: "Commercial", definition: "Consultative selling — selling as an advisor with value-added solutions.", levels: GENERIC },
  { code: "CPS", name: "Content Production & Storytelling", category: "TECHNICAL", department: "Commercial", definition: "Content production & storytelling — creating content that delivers the brand message persuasively.", levels: GENERIC },
  { code: "DCM", name: "Digital Campaign Management", category: "TECHNICAL", department: "Commercial", definition: "Digital campaign management — planning, executing & optimizing campaigns.", levels: GENERIC },
  { code: "DPE", name: "Digital Prospecting & Engagement", category: "TECHNICAL", department: "Commercial", definition: "Digital prospecting — approaching & building initial interactions with potential customers.", levels: GENERIC },
  { code: "MKI", name: "Market Intelligence", category: "TECHNICAL", department: "Commercial", definition: "Market intelligence — analyzing market, consumer & competitor trends.", levels: GENERIC },
  { code: "MDA", name: "Marketing Data Analytics", category: "TECHNICAL", department: "Commercial", definition: "Marketing data analytics — turning metrics (ROI/CTR/CPA) into actionable insights.", levels: GENERIC },
  { code: "PSM", name: "Product & Solution Mastery", category: "TECHNICAL", department: "Commercial", definition: "Product & solution mastery — knowing features, benefits & unique value vs competitors.", levels: GENERIC },
  { code: "RM", name: "Relationship Management", category: "TECHNICAL", department: "Commercial", definition: "Relationship management — nurturing long-term relationships with clients/partners.", levels: GENERIC },
  { code: "SEO", name: "Search Engine Optimization Mastery", category: "TECHNICAL", department: "Commercial", definition: "SEO mastery — improving web visibility & ranking (on/off-page & technical).", levels: GENERIC },
  { code: "SCS", name: "SEO Content Strategy", category: "TECHNICAL", department: "Commercial", definition: "SEO content strategy — aligning content with search intent for organic traffic.", levels: GENERIC },
  { code: "SNG", name: "Strategic Negotiation", category: "TECHNICAL", department: "Commercial", definition: "Strategic negotiation — reaching win-win agreements while preserving relationships.", levels: GENERIC },
  { code: "VCO", name: "Visual Conceptualization", category: "TECHNICAL", department: "Commercial", definition: "Visual conceptualization — translating briefs into on-brand visual concepts.", levels: GENERIC },
  // Operations
  { code: "HRG", name: "HR Governance & Compliance", category: "TECHNICAL", department: "Operations", definition: "HR governance & compliance — personnel administration in line with regulations.", levels: GENERIC },
  { code: "PSME", name: "Performance Strategy & Metrics", category: "TECHNICAL", department: "Operations", definition: "Performance strategy & metrics — designing KPI/OKR systems aligned with business goals.", levels: GENERIC },
  { code: "ORGD", name: "Organizational Development", category: "TECHNICAL", department: "Operations", definition: "Organizational development — designing structure & culture for work effectiveness.", levels: GENERIC },
  { code: "REC", name: "Recruitment & Selection", category: "TECHNICAL", department: "Operations", definition: "Recruitment & selection — attracting & selecting the best talent.", levels: GENERIC },
  { code: "REM", name: "Remuneration Management", category: "TECHNICAL", department: "Operations", definition: "Remuneration management — managing competitive payroll, compensation & benefits.", levels: GENERIC },
  { code: "SFP", name: "Strategic Financial Planning", category: "TECHNICAL", department: "Operations", definition: "Strategic financial planning — financial analysis for projections & investment decisions.", levels: GENERIC },
  { code: "FMD", name: "Financial Modeling", category: "TECHNICAL", department: "Operations", definition: "Financial modeling — building simulations to predict financial performance.", levels: GENERIC },
  { code: "TCC", name: "Treasury & Cost Control", category: "TECHNICAL", department: "Operations", definition: "Treasury & cost control — managing cash flow, spending & liquidity.", levels: GENERIC },
  { code: "FGA", name: "Financial Governance & Audit", category: "TECHNICAL", department: "Operations", definition: "Financial governance & audit — safeguarding integrity through controls & audits.", levels: GENERIC },
  { code: "TAX", name: "Taxation Management", category: "TECHNICAL", department: "Operations", definition: "Taxation management — planning, calculating & reporting tax obligations.", levels: GENERIC },
];
