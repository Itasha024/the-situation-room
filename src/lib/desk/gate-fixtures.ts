/**
 * Labelled real traffic, for measuring the gate.
 *
 * Every item here was actually pulled from the operator's catalogue. The labels
 * are the editorial judgement the desk is supposed to reproduce:
 *
 *   feed    — carry it, it is about this conflict or a party to it
 *   tray    — plausibly relevant but not established; hold for corroboration
 *   exclude — not this conflict, or not news
 *
 * There is no single correct threshold, so the gate is tuned against BOTH
 * directions at once: rescuing the feed items must not drag the excludes in.
 * `npm test` reports precision and recall per source class from this set.
 *
 * When the gate gets something wrong in production, add the item here first,
 * then fix the rule. That way the fix is permanent.
 */

export type GateLabel = "feed" | "tray" | "exclude";

export type GateFixture = {
  /** Why this case exists. Shown when the assertion fails. */
  name: string;
  source: string;
  text: string;
  label: GateLabel;
  agency?: boolean;
};

export const GATE_FIXTURES: GateFixture[] = [
  /* ---------------------------------------------------------------- *
   * (a) Launches, strikes, impacts, alerts — Yemen, Saudi Arabia, sea
   * ---------------------------------------------------------------- */
  {
    name: "rocket launchers in the Marib battle — pure category (a)",
    source: "Almashhad",
    text: "راجمات الصواريخ تدخل المعركة في مأرب.. وعمليات الجيش اليمني تطارد الحوثيين في محور بيحان دمرت القوات المسلحة اليمنية مرابض مدفعية تابعة لمليشيا الحوثي في الجبهة الجنوبية لمحافظة مأرب، عبر ضربات نفذتها براجمات الصواريخ، بالتزامن مع قصف مدفعي",
    label: "feed",
  },
  {
    name: "a fragment naming a Saudi city and an observable — the 'smoke in Riyadh' class",
    source: "Sabereen News",
    text: "عاجل | دخان كثيف في سماء الرياض",
    label: "feed",
  },
  {
    name: "sirens over named Saudi cities",
    source: "Al Hadath",
    text: "صفارات الإنذار تدوي في الرياض والخرج مع سماع دوي انفجارات",
    label: "feed",
  },
  {
    name: "a commander killed on a Yemeni front",
    source: "Almashhad",
    text: "خلال 72 ساعة فقط.. القائد يلحق بنائبه وشقيقه في أنصع ملاحم البطولة ضد الحوثيين ارتقى أمس قائد فصيلة أبناء المسيمير، البطل ينوف فضل دحان الحوشبي، شهيداً متأثراً بإصابته أثناء مشاركته الميدانية",
    label: "feed",
  },
  {
    name: "demining in Yemen — conflict consequence, not front-line",
    source: "Almashhad",
    text: "مسام يزيل نحو 4 آلاف لغم وذخيرة وعبوة ناسفة حوثية خلال 18 يوماً أعلن مشروع «مسام» لنزع الألغام في اليمن، إزالة 3887 لغماً وذخيرة غير منفجرة",
    label: "feed",
  },

  /* ---------------------------------------------------------------- *
   * (b) Statements by parties to the conflict
   * ---------------------------------------------------------------- */
  {
    name: "Pakistan and Turkey messaging Tehran about an operation against the Houthis",
    source: "Almashhad",
    text: "رسائل حاسمة من باكستان وتركيا إلى طهران.. هل اقتربت الساعة للعملية العسكرية الكبرى ضد الحوثيين؟ تكشفت تفاصيل جديدة حول الجولة الأخيرة من الصراع الميداني",
    label: "feed",
  },
  {
    name: "a Yemeni government commander on the Marib front",
    source: "Almashhad",
    text: "اللواء ثوابة: مأرب اليوم تهاجم وعينها على صنعاء.. والقوات المسلحة تتوعد بمواصلة المعركة وانهاء انقلاب الحوثيين",
    label: "feed",
  },
  {
    name: "Turkish military cargo flights resupplying Saudi Arabia — a party's capability",
    source: "Sabereen News",
    text: "تقوم عدد من طائرات الشحن العسكرية التركية بعمليات تسليم إلى السعودية",
    label: "feed",
  },
  {
    name: "a US arms sale to a party to the conflict",
    source: "Reuters",
    text: "The United States has approved the sale of F-35 fighter jets to Saudi Arabia, officials said, in a deal that would reshape the kingdom's air power.",
    label: "feed",
    agency: true,
  },
  {
    name: "unity-of-fronts framing — other theatres named BY a party, about this war",
    source: "Al-Masirah",
    text: "قال قائد أنصار الله إن جبهات المقاومة موحدة وإن ما يجري في اليمن مرتبط بما يجري في غزة ولبنان، مؤكداً استمرار العمليات",
    label: "feed",
  },
  {
    name: "the Mecca Agreement as a subject, with no Yemen word in the sentence",
    source: "Asharq Al-Awsat",
    text: "مصادر دبلوماسية: اتفاق مكة يواجه عقبات جديدة بعد رفض أحد الأطراف بنود الترتيبات الأمنية",
    label: "feed",
  },
  {
    name: "Pakistani minister in Tehran, Hormuz and negotiations — adjacent, unestablished",
    source: "Al-Araby Television",
    text: "بين مضيق هرمز والمفاوضات.. وزير الداخلية الباكستاني محسن نقوي يزور العاصمة طهران",
    label: "tray",
  },
  {
    name: "Qatar mediating Iran–Washington talks — indirect, affects the Iranian track",
    source: "Al Jazeera",
    text: "عاجل | المتحدث باسم الخارجية القطرية: نعمل عبر فريق الوساطة لدينا مع طهران وواشنطن لمعرفة إمكانية استئناف المحادثات",
    label: "tray",
  },

  /* ---------------------------------------------------------------- *
   * (c) Exclusives and source-based reporting
   * ---------------------------------------------------------------- */
  {
    name: "Arabic source-based scoop naming the outlet itself",
    source: "Al-Akhbar",
    text: "خاص | قالت مصادر مطلعة لـ«الأخبار» إن ترتيبات جديدة تجري بين الرياض وصنعاء بشأن وقف إطلاق النار في الحديدة",
    label: "feed",
  },
  {
    name: "English exclusive phrasing in the body",
    source: "WSJ",
    text: "People familiar with the matter said the Saudi government has quietly sounded out mediators about a ceasefire framework in Yemen, according to officials briefed on the discussions.",
    label: "feed",
    agency: true,
  },
  {
    name: "informed sources, Arabic, no explicit exclusive marker",
    source: "Al-Araby Al-Jadeed",
    text: "أفادت مصادر مطلعة بأن معلومات وردت عن تحركات عسكرية جديدة في محيط مأرب خلال الساعات الماضية",
    label: "feed",
  },

  /* ---------------------------------------------------------------- *
   * Exclusions — the other half of the balance
   * ---------------------------------------------------------------- */
  {
    name: "the Palestinian file as the subject",
    source: "Al-Araby Television",
    text: "مداهمات ومسح منزل منفذ عملية رام الله.. تشديد إسرائيلي للإجراءات العسكرية في بلدة بدو",
    label: "exclude",
  },
  {
    name: "Qatar condemning an Al-Aqsa raid",
    source: "Al-Araby Television",
    text: "#عاجل | الخارجية القطرية: دولة قطر تدين اقتحام وزير الأمن القومي الإسرائيلي المتطرف ومستوطنين المسجد الأقصى المبارك",
    label: "exclude",
  },
  {
    name: "Gaza aid as the subject, spoken by a third party",
    source: "Al Jazeera",
    text: "عاجل | رئيس الوزراء وزير الخارجية القطري: للأسف هناك طرف يواصل القتل ومنع دخول المساعدات لغزة والعالم لا يفعل شيئا",
    label: "exclude",
  },
  {
    name: "Berlin community politics",
    source: "Al-Araby Television",
    text: "ما هي الأسباب التي تدفع غالبية أفراد الجالية العربية في برلين إلى العزوف عن التصويت في انتخابات الولاية؟",
    label: "exclude",
  },
  {
    name: "Kurdistan explosions",
    source: "Al Hadath",
    text: "جهاز مكافحة الإرهاب في إقليم كردستان: انفجارا أربيل ناجمان عن تدريبات عسكرية ونشاط أمني",
    label: "exclude",
  },
  {
    name: "football",
    source: "Almashhad",
    text: "ريال مدريد يصطدم بتألق أوبلاك وكورتوا في شوط أول بلا أهداف أمام أتلتيكو في ديربي مدريد ضمن الجولة السابعة من الدوري",
    label: "exclude",
  },
  {
    name: "university exams in Ibb — domestic admin, not the war",
    source: "Saba",
    text: "رئيس جامعة إب يتفقد سير الاختبارات النهائية بكلية العلوم الإدارية تفقد رئيس جامعة إب الدكتور نصر الحجيلي، اليوم، سير الاختبارات النهائية للفصل الدراسي الأول",
    label: "exclude",
  },
  {
    name: "an anniversary rally by the Houthi administration",
    source: "Saba",
    text: "الهيئة الوطنية العليا لمكافحة الفساد تُحيي العيد الـ 12 لثورة 21 سبتمبر المجيدة بفعالية خطابية تحت شعار ثورة بناء وتغيير",
    label: "exclude",
  },
  {
    name: "local-government service and development projects — leaked into the feed once",
    source: "Saba",
    text: "مناقشة تقييم خطة تنفيذ المشاريع الخدمية والتنموية بالبيضاء ناقش اجتماع بمحافظة البيضاء برئاسة المحافظ عبدالله ادريس اليوم تقييم خطة تنفيذ المشاريع الخدمية والتنموية والزراعية",
    label: "exclude",
  },
  {
    name: "another theatre whose place name collided with a gazetteer alias",
    // "مازالت" contains "ازال" (Azal, a Sanaa district), so this Erbil report
    // acquired a Yemeni place and passed as on-topic.
    source: "Shajab News",
    text: "أعمدة الدخان مازالت تتصاعد في أربيل",
    label: "exclude",
  },
  {
    name: "Sudan, whose text collided with Ibb via the word إبادة",
    source: "Al Hadath",
    text: 'حكومة النيل الأزرق لـ"الحدث": الدعم السريع ارتكب جرائم إبادة جماعية في الكرمك وقيسان',
    label: "exclude",
  },
  {
    name: "customs and statistics offices holding an event",
    source: "Saba",
    text: "فعالية خطابية لمكاتب الجمارك والأراضي والصناعة والإحصاء في ذمار نظمت مكاتب جمارك ورقابة ذمار، والأراضي والمساحة والتخطيط العمراني",
    label: "exclude",
  },
  {
    name: "Falkland oil and Israel",
    source: "Al-Araby Television",
    text: "ما قصة نفط فوكلاند.. وما علاقة إسرائيل به؟ #اقتصاد_كم",
    label: "exclude",
  },
  {
    name: "the aircraft-spotting trap the desk already documents",
    source: "Sabereen News",
    text: "نشاط مكثف لطائرات المراقبة والإنذار المبكر السعودية من طرازي King Air 350i وSaab 2000، مع تحليق 4 طائرات في الوقت نفسه",
    label: "exclude",
  },
];
