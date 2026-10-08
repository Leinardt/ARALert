import os
import json

slides = [
    {
        "num": 1,
        "title": "Title Slide (The Color Purple)",
        "section": "Hero Title",
        "notes": "Welcome the audience. Introduce Alice Walker's masterpiece 'The Color Purple', explaining that this presentation focuses directly on Letters 61–69 (SparkNotes Section 6) following the assigned 7-part outline while bridging every literary convention to Information Technology principles."
    },
    {
        "num": 2,
        "title": "Reporters Slide",
        "section": "Group Reporting",
        "notes": "Introduce the reporting group: Danilyn Krixtin Baraquiel, Kathleen Ann Borromeo, and Leinardt Lontoc (presenting the IT Background & Systems Analysis)."
    },
    {
        "num": 3,
        "title": "I. Historical Timeline – Genesis & 1982 Publication",
        "section": "Historical Timeline",
        "notes": "Detail the real-world history and genesis of the book: Alice Walker's ancestral inspiration from her grandparents in rural Georgia, her 1980–1981 retreat to Boonville, California where the characters spoke in authentic vernacular, the 1982 Harcourt Brace publication, and the nationwide critical reception. IT parallel: discrete development lifecycles and source repository initialization."
    },
    {
        "num": 4,
        "title": "I. Historical Timeline – Awards, Banning & Legacy",
        "section": "Historical Timeline",
        "notes": "Examine the real-world historical trajectory of the book: the historic 1983 Pulitzer Prize and National Book Award double win, widespread censorship and banning battles across American schools, Spielberg's 1985 film, Broadway musicals, and enduring global legacy. IT parallel: software release certification, cross-platform porting, and protocol resilience."
    },
    {
        "num": 5,
        "title": "II. Conventions – Alice Walker's Womanism",
        "section": "School of Thought",
        "notes": "Detail Womanism as defined by Alice Walker: committed to the survival and wholeness of entire people, male and female, centered on communal healing and redemptive transformation. IT parallel: multi-variable concurrent architecture handling competing constraints."
    },
    {
        "num": 6,
        "title": "II. Conventions – Epistolary & Folk Realism",
        "section": "School of Thought",
        "notes": "Examine the Epistolary structure and African American Folk Realism: unmediated first-person letters providing an unhackable data vault for trauma, validating Black folk speech (AAVE). IT parallel: immutable event sourcing and native domain-specific protocols."
    },
    {
        "num": 7,
        "title": "II. Conventions – Panentheism & Anti-Imperialism",
        "section": "School of Thought",
        "notes": "Discuss Panentheism (dethroning the patriarchal white male god in favor of an immanent divine spirit in creation) and African Anti-Imperialism (British corporate exploitation of the Olinka). IT parallel: decentralized edge computing and open-source commons defense."
    },
    {
        "num": 8,
        "title": "III. Author's Biography – Early Life & Roots",
        "section": "Author's Biography",
        "notes": "Present Alice Walker's upbringing in Eatonton, Georgia, her tenant-farmer family roots, and the pivotal childhood BB gun accident that blinded her right eye, driving her into solitary reading and reflective writing. IT parallel: hardware bottlenecks sparking elegant algorithmic breakthroughs."
    },
    {
        "num": 9,
        "title": "III. Author's Biography – Activism & Legacy",
        "section": "Author's Biography",
        "notes": "Detail Walker's civil rights activism in Mississippi facing Ku Klux Klan threats, her academic excavation resurrecting Zora Neale Hurston's unmarked grave, and becoming the first Black woman to win the Pulitzer Prize for Fiction. IT parallel: open-source software archaeology and preserving foundational legacy repositories."
    },
    {
        "num": 10,
        "title": "IV. Summary – Scope & Section Breakdown",
        "section": "Summary Divider",
        "notes": "Introduce the four-part breakdown of the summary, explicitly mapping each part to its source: Part I (Novel Background: Letters 1–60), Part II (SparkNotes Section 6: Letters 61–65), Part III (SparkNotes Section 6: Letters 66–68), and Part IV (SparkNotes Section 6: Letters 68–69)."
    },
    {
        "num": 11,
        "title": "IV. Summary – Part I: Contextual Background (Letters 1–60)",
        "section": "Summary of Work",
        "notes": "Summarize the primary novel context (Letters 1–60): Celie's childhood trauma and forced silencing by Alphonso, her chattel marriage to Albert, Sofia's fierce resistance and incarceration, and Shug Avery's transformative affection."
    },
    {
        "num": 12,
        "title": "IV. Summary – Part II: Letters 61–65 (SparkNotes Section 6)",
        "section": "Summary of Work",
        "notes": "Detail SparkNotes Section 6 Part 1 (Letters 61–65): Celie and Shug discover decades of Nettie's letters hidden in Albert's trunk; Nettie's escape from Albert's predatory assault; finding Celie's stolen children alive with Samuel and Corrine; the transatlantic journey to West Africa. IT parallel: Man-in-the-Middle cache interception and packet recovery."
    },
    {
        "num": 13,
        "title": "IV. Summary – Part III: Letters 66–68 (SparkNotes Section 6)",
        "section": "Summary of Work",
        "notes": "Examine SparkNotes Section 6 Part 2 (Letters 66–68): Olinka village culture and veneration of the sacred roofleaf; the arrival of the English rubber company road bulldozing the village; the imposition of corrugated tin roofs and water taxes; Corrine's reconciliation and peaceful death. IT parallel: corporate monoculture destroying open commons."
    },
    {
        "num": 14,
        "title": "IV. Summary – Part IV: Letters 68–69 (SparkNotes Section 6)",
        "section": "Summary of Work",
        "notes": "Cover SparkNotes Section 6 Part 3 (Letters 68–69): Samuel reveals Alphonso is NOT Celie and Nettie's father ('Pa is not our pa!'); lifting of incest trauma; Celie sublimates rage into sewing custom pants ('Folkspants'); the epistolary header shift to 'DEAR NETTIE'; Shug's Panentheism and the Color Purple motif. IT parallel: data provenance cleansing and DNS endpoint rerouting."
    },
    {
        "num": 15,
        "title": "V. Analysis of The Literary Work – Divider",
        "section": "Analysis Divider",
        "notes": "Transition to the deep literary analysis section, examining setting dynamics, character metamorphosis, linguistic registers, and layered symbolic motifs."
    },
    {
        "num": 16,
        "title": "V. Analysis – Setting Analysis",
        "section": "Literary Analysis",
        "notes": "Contrast the dual settings: the claustrophobic, patriarchal plantation economy of Rural Georgia versus the communal, spiritually grounded yet vulnerable Olinka Village in West Africa. Note the thematic resonance of transatlantic displacement."
    },
    {
        "num": 17,
        "title": "V. Analysis – Character Transformation",
        "section": "Literary Analysis",
        "notes": "Analyze Celie's dramatic psychological metamorphosis from a silent, disembodied object of abuse into an autonomous, economically self-sufficient artist, supported by female solidarity with Shug, Sofia, and Nettie."
    },
    {
        "num": 18,
        "title": "V. Analysis – Deep Symbolism",
        "section": "Literary Analysis",
        "notes": "Examine the central symbolic motifs: The Color Purple (divine appreciation and wonder), The Sacred Roofleaf (indigenous harmony vs colonial disruption), and Folkspants (gender liberation, economic agency, and creative craft)."
    },
    {
        "num": 19,
        "title": "VI. Literary Rating – Intro Hero",
        "section": "Rating Divider",
        "notes": "Introduce the rigorous critical evaluation of The Color Purple based on classical literary standards and major international literary awards."
    },
    {
        "num": 20,
        "title": "VI. Seven Literary Standards Table (Garcia et al., 2000)",
        "section": "Literary Standards",
        "notes": "Present the comprehensive evaluation matrix citing Garcia, Rosales, and Barranco (UST Publishing House, 2000), rating the novel across Artistry, Intellectual Value, Suggestiveness, Spiritual Value, Permanence, Universality, and Style (10/10)."
    },
    {
        "num": 21,
        "title": "VI. Standards of Literary Awards & Prizes",
        "section": "Awards & Prizes",
        "notes": "Highlight the novel's historic accolades: 1983 Pulitzer Prize for Fiction, 1983 National Book Award, 11 Oscar nominations, and multiple Tony Awards, cementing its permanent place in world literature."
    },
    {
        "num": 22,
        "title": "VII. The Color Purple & Modern Tech (Part 1)",
        "section": "IT & Systems Bridge",
        "notes": "Examine the IT parallels in the standard comparison table: CIA Triad & Man-in-the-Middle Interception (Albert's trunk), Asynchronous Messaging & Missing ACKs (letters to God), and Data Provenance & Metadata Rectification (paternity truth)."
    },
    {
        "num": 23,
        "title": "VII. The Color Purple & Modern Tech (Part 2)",
        "section": "IT & Systems Bridge",
        "notes": "Continue IT parallels: DNS Rerouting & Header Decoupling ('Dear Nettie'), Open Source Commons vs Proprietary Lock-In (Roofleaf vs Rubber Company), and Algorithmic Bias vs Womanism (Buolamwini & Gebru's Gender Shades)."
    },
    {
        "num": 24,
        "title": "IT Discussion Question",
        "section": "Interactive Discussion",
        "notes": "Facilitate class discussion on how centralized control over communication channels impacts marginalized communities in digital architectures, drawing parallels between Albert's locked trunk and modern algorithmic gatekeeping."
    },
    {
        "num": 25,
        "title": "Addition – Symbolism & Media Adaptations",
        "section": "Media Adaptations",
        "notes": "Explore the evolution of visual symbolism across Spielberg's 1985 film, the Broadway stage musical, and the 2023 musical adaptation, noting how costume design and color palettes convey interior character growth."
    },
    {
        "num": 26,
        "title": "VII. References & Works Cited / Thank You",
        "section": "References & Thank You",
        "notes": "Acknowledge academic references: primary text, SparkNotes analysis, Walker's essays, Garcia et al. (2000), Buolamwini & Gebru (2018), and NIST standards. Thank the instructor and classmates, and invite questions."
    }
]

html_template = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Color Purple (Letters 61–69) – Literary Reporting Deck</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg-dark: #1b0c2e;
      --bg-card: #271440;
      --plum-deep: #2d1245;
      --purple-primary: #4a1c70;
      --purple-light: #f5f0fa;
      --gold-accent: #d4af37;
      --gold-hover: #f3cf65;
      --text-main: #f5f0fa;
      --text-muted: #b8a6cf;
      --border-color: rgba(212, 175, 55, 0.3);
      --card-bg: #efece6;
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      font-family: 'Inter', sans-serif;
      background: radial-gradient(circle at 50% 20%, #2b1142 0%, #150824 100%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }}

    header {{
      padding: 14px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(25, 10, 38, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 100;
    }}

    .logo-group h1 {{
      font-family: 'Playfair Display', serif;
      font-size: 19px;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .logo-group h1 span {{
      color: var(--gold-accent);
      font-family: 'Cinzel', serif;
      font-size: 12px;
      padding: 3px 8px;
      border: 1px solid var(--gold-accent);
      border-radius: 4px;
      letter-spacing: 1px;
    }}

    .nav-actions {{
      display: flex;
      gap: 12px;
      align-items: center;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.25s ease;
      border: none;
    }}

    .btn-gold {{
      background: linear-gradient(135deg, #d4af37 0%, #aa841e 100%);
      color: #1b0c2e;
      box-shadow: 0 4px 14px rgba(212, 175, 55, 0.35);
    }}

    .btn-gold:hover {{
      background: linear-gradient(135deg, #e5c358 0%, #be9425 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(212, 175, 55, 0.5);
    }}

    .btn-outline {{
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }}

    .btn-outline:hover {{
      background: rgba(255, 255, 255, 0.15);
      border-color: var(--gold-accent);
      color: var(--gold-accent);
    }}

    main {{
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 24px 60px 24px;
      max-width: 1380px;
      margin: 0 auto;
      width: 100%;
    }}

    .viewer-container {{
      width: 100%;
      background: #0f0517;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }}

    .slide-stage {{
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #11071c;
      overflow: hidden;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }}

    .slide-stage img {{
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      transition: opacity 0.2s ease-in-out;
    }}

    .stage-overlay-btn {{
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      background: rgba(27, 12, 46, 0.65);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(212, 175, 55, 0.4);
      color: #fff;
      font-size: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 10;
    }}

    .stage-overlay-btn:hover {{
      background: rgba(212, 175, 55, 0.9);
      color: #1b0c2e;
      border-color: #fff;
      transform: translateY(-50%) scale(1.1);
    }}

    .btn-prev-overlay {{ left: 16px; }}
    .btn-next-overlay {{ right: 16px; }}

    .controls-bar {{
      background: #180927;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border-color);
    }}

    .slide-info-meta {{
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    .badge-section {{
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid var(--gold-accent);
      color: var(--gold-accent);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }}

    .slide-active-title {{
      font-size: 14px;
      font-weight: 600;
      color: #fff;
    }}

    .slide-nav {{
      display: flex;
      align-items: center;
      gap: 14px;
    }}

    .nav-btn {{
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.2s;
    }}

    .nav-btn:hover:not(:disabled) {{
      background: var(--gold-accent);
      color: #1b0c2e;
      border-color: var(--gold-accent);
    }}

    .nav-btn:disabled {{ opacity: 0.3; cursor: not-allowed; }}

    .slide-counter {{
      font-family: 'Fira Code', monospace;
      font-size: 13px;
      color: var(--text-muted);
    }}

    .slide-counter span {{ color: var(--gold-accent); font-weight: 700; font-size: 15px; }}

    .notes-panel {{
      background: #1d0e30;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      margin-top: 18px;
      width: 100%;
      padding: 20px 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }}

    .notes-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      padding-bottom: 8px;
    }}

    .notes-header h3 {{
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      color: var(--gold-accent);
      display: flex;
      align-items: center;
      gap: 8px;
    }}

    .notes-hint {{
      font-size: 12px;
      color: var(--text-muted);
    }}

    .notes-content {{
      font-size: 13.5px;
      line-height: 1.6;
      color: #e0d4f0;
    }}

    .thumbnails-drawer {{
      margin-top: 24px;
      width: 100%;
      background: #140722;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 18px 22px;
    }}

    .thumbnails-drawer h2 {{
      font-family: 'Playfair Display', serif;
      font-size: 16px;
      color: #fff;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .thumbnails-drawer h2 span {{
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      color: var(--gold-accent);
      font-weight: 400;
    }}

    .thumb-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 6px;
    }}

    .thumb-grid::-webkit-scrollbar {{
      width: 6px;
    }}
    .thumb-grid::-webkit-scrollbar-thumb {{
      background: rgba(212, 175, 55, 0.3);
      border-radius: 3px;
    }}

    .thumb-item {{
      background: #231138;
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
    }}

    .thumb-item img {{
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      display: block;
    }}

    .thumb-item:hover {{
      border-color: var(--gold-accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
    }}

    .thumb-item.active {{
      border-color: var(--gold-accent);
      box-shadow: 0 0 0 2px var(--gold-accent);
    }}

    .thumb-meta {{
      padding: 5px 6px;
      background: #180927;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--text-muted);
    }}

    .thumb-item.active .thumb-meta {{
      color: var(--gold-accent);
      font-weight: 700;
    }}

    @media (max-width: 800px) {{
      header {{ padding: 12px 16px; flex-direction: column; gap: 12px; }}
      .controls-bar {{ flex-direction: column; gap: 12px; }}
    }}
  </style>
</head>
<body>

  <!-- HEADER -->
  <header>
    <div class="logo-group">
      <h1>The Color Purple <span>LETTERS 61–69</span></h1>
    </div>
    <div class="nav-actions">
      <a href="The_Color_Purple_Letters_61-69_IT_Report.pptx" download class="btn btn-gold">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download PPTX
      </a>
      <a href="The_Color_Purple_Letters_61-69_IT_Report.pdf" download class="btn btn-outline">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        Download PDF
      </a>
    </div>
  </header>

  <!-- MAIN VIEWPORT -->
  <main>
    <div class="viewer-container">
      <div class="slide-stage" id="slideStage">
        <button class="stage-overlay-btn btn-prev-overlay" id="btnPrevOverlay" onclick="prevSlide()" title="Previous Slide (Left Arrow)">❮</button>
        <img id="activeSlideImg" src="slides_img/slide_01.png" alt="Slide Preview">
        <button class="stage-overlay-btn btn-next-overlay" id="btnNextOverlay" onclick="nextSlide()" title="Next Slide (Right Arrow)">❯</button>
      </div>

      <!-- CONTROLS BAR -->
      <div class="controls-bar">
        <div class="slide-info-meta">
          <span class="badge-section" id="activeBadge">Hero Title</span>
          <span class="slide-active-title" id="activeTitle">Title Slide (The Color Purple)</span>
        </div>

        <div class="slide-nav">
          <button class="nav-btn" id="prevBtn" onclick="prevSlide()" title="Previous Slide">❮</button>
          <div class="slide-counter">Slide <span id="currentNum">1</span> / <span id="totalNum">26</span></div>
          <button class="nav-btn" id="nextBtn" onclick="nextSlide()" title="Next Slide">❯</button>
          <button class="nav-btn" onclick="toggleFullScreen()" title="Full Screen (F)">⛶</button>
        </div>
      </div>
    </div>

    <!-- SPEAKER NOTES -->
    <div class="notes-panel">
      <div class="notes-header">
        <h3>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Presenter Speaking Notes & IT Discussion Guide
        </h3>
        <span class="notes-hint">Use ◄ ► arrows or Spacebar to navigate</span>
      </div>
      <div class="notes-content" id="notesContent">
        Welcome the audience. Introduce Alice Walker's masterpiece 'The Color Purple', explaining that this presentation focuses directly on Letters 61–69 (SparkNotes Section 6) following the assigned 7-part outline while bridging every literary convention to Information Technology principles.
      </div>
    </div>

    <!-- THUMBNAILS DRAWER -->
    <div class="thumbnails-drawer">
      <h2>Slide Overview <span>(Click any slide to jump)</span></h2>
      <div class="thumb-grid" id="thumbGrid"></div>
    </div>
  </main>

  <script>
    const slidesData = {json.dumps(slides)};
    let currentSlide = 0;

    const imgEl = document.getElementById('activeSlideImg');
    const badgeEl = document.getElementById('activeBadge');
    const titleEl = document.getElementById('activeTitle');
    const currentNumEl = document.getElementById('currentNum');
    const totalNumEl = document.getElementById('totalNum');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const prevOverlay = document.getElementById('btnPrevOverlay');
    const nextOverlay = document.getElementById('btnNextOverlay');
    const notesEl = document.getElementById('notesContent');
    const thumbGrid = document.getElementById('thumbGrid');

    totalNumEl.textContent = slidesData.length;

    function renderSlide(index) {{
      currentSlide = index;
      const data = slidesData[index];
      const slideNumFormatted = String(index + 1).padStart(2, '0');

      imgEl.style.opacity = '0.3';
      imgEl.src = `slides_img/slide_${{slideNumFormatted}}.png`;
      imgEl.onload = () => {{
        imgEl.style.opacity = '1';
      }};

      badgeEl.textContent = data.section;
      titleEl.textContent = data.title;
      currentNumEl.textContent = index + 1;
      notesEl.textContent = data.notes;

      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === slidesData.length - 1;
      prevOverlay.style.display = index === 0 ? 'none' : 'flex';
      nextOverlay.style.display = index === slidesData.length - 1 ? 'none' : 'flex';

      document.querySelectorAll('.thumb-item').forEach((item, idx) => {{
        item.classList.toggle('active', idx === index);
      }});
    }}

    function nextSlide() {{
      if (currentSlide < slidesData.length - 1) {{
        renderSlide(currentSlide + 1);
      }}
    }}

    function prevSlide() {{
      if (currentSlide > 0) {{
        renderSlide(currentSlide - 1);
      }}
    }}

    function toggleFullScreen() {{
      const elem = document.getElementById("slideStage");
      if (!document.fullscreenElement) {{
        elem.requestFullscreen().catch(err => alert(`Error: ${{err.message}}`));
      }} else {{
        document.exitFullscreen();
      }}
    }}

    slidesData.forEach((s, idx) => {{
      const thumb = document.createElement('div');
      thumb.className = `thumb-item ${{idx === 0 ? 'active' : ''}}`;
      thumb.onclick = () => renderSlide(idx);

      const numStr = String(idx + 1).padStart(2, '0');
      thumb.innerHTML = `
        <img src="slides_img/slide_${{numStr}}.png" alt="Slide ${{idx + 1}}">
        <div class="thumb-meta">
          <span>SLIDE ${{idx + 1}}</span>
          <span>${{s.section}}</span>
        </div>
      `;
      thumbGrid.appendChild(thumb);
    }});

    document.addEventListener('keydown', (e) => {{
      if (e.key === 'ArrowRight' || e.key === ' ') {{
        e.preventDefault();
        nextSlide();
      }} else if (e.key === 'ArrowLeft') {{
        e.preventDefault();
        prevSlide();
      }} else if (e.key.toLowerCase() === 'f') {{
        toggleFullScreen();
      }}
    }});

    renderSlide(0);
  </script>
</body>
</html>
'''

with open(r'c:\Users\Leinardt\OneDrive\Documents\ARALert\presentation\index.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

print('Updated index.html successfully with all 26 slides.')
