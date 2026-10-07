import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_pptx_path):
    prs = Presentation()
    # 16:9 widescreen: 13.333 x 7.5 inches (matches 1440x810 in reference PDF)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Reference Color Palette:
    # Gawain used forest green (#1F5C37) on cream (#ECEBE4).
    # For The Color Purple, we use Royal Deep Purple (#2E0E44 / #3B1C54 / #4A1C70) on cream (#EFECE6)!
    C_HERO_BG = RGBColor(46, 14, 68)          # #2E0E44 (Deep Royal Plum)
    C_CREAM_BG = RGBColor(239, 236, 230)      # #EFECE6 (Warm Vintage Parchment / Cream)
    C_PRIMARY_PURPLE = RGBColor(74, 28, 112)  # #4A1C70 (Main Theme Purple)
    C_DEEP_PURPLE = RGBColor(59, 28, 84)      # #3B1C54 (Card / Table Headers)
    C_ACCENT_BURGUNDY = RGBColor(136, 30, 68) # #881E44 (Heart / Diamond Red)
    C_GOLD = RGBColor(200, 160, 56)           # #C8A038 (Subtle Gold Star / Accent)
    C_WHITE = RGBColor(255, 255, 255)         # #FFFFFF (White)
    C_OFFWHITE = RGBColor(245, 242, 235)      # #F5F2EB (Card Face)
    C_TEXT_DARK = RGBColor(34, 30, 40)        # #221E28 (Body Text)
    C_TEXT_MUTED = RGBColor(90, 80, 100)      # #5A5064 (Muted)
    C_LINE_PURPLE = RGBColor(74, 28, 112)     # #4A1C70 (Horizontal Dividers)

    def set_bg(slide, color):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def add_playing_card(slide, left, top, width, height, rank="A", suit="♠", suit_color=C_PRIMARY_PURPLE):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = suit_color
        card.line.width = Pt(1.5)

        # Top-left rank & suit
        tb_tl = slide.shapes.add_textbox(left + Inches(0.12), top + Inches(0.1), Inches(0.8), Inches(0.8))
        tf_tl = tb_tl.text_frame
        tf_tl.margin_left = tf_tl.margin_top = tf_tl.margin_right = tf_tl.margin_bottom = 0
        p_r = tf_tl.paragraphs[0]
        p_r.text = rank
        p_r.font.name = "Georgia"
        p_r.font.size = Pt(18)
        p_r.font.bold = True
        p_r.font.color.rgb = suit_color
        
        p_s = tf_tl.add_paragraph()
        p_s.text = suit
        p_s.font.size = Pt(14)
        p_s.font.color.rgb = suit_color

        # Center large symbol
        tb_c = slide.shapes.add_textbox(left + Inches(0.2), top + height/2 - Inches(0.6), width - Inches(0.4), Inches(1.2))
        tf_c = tb_c.text_frame
        tf_c.margin_left = tf_c.margin_top = tf_c.margin_right = tf_c.margin_bottom = 0
        p_c = tf_c.paragraphs[0]
        p_c.alignment = PP_ALIGN.CENTER
        p_c.text = suit
        p_c.font.size = Pt(36)
        p_c.font.color.rgb = suit_color

        # Bottom-right inverted rank & suit
        tb_br = slide.shapes.add_textbox(left + width - Inches(0.8), top + height - Inches(0.85), Inches(0.68), Inches(0.8))
        tf_br = tb_br.text_frame
        tf_br.margin_left = tf_br.margin_top = tf_br.margin_right = tf_br.margin_bottom = 0
        p_br_s = tf_br.paragraphs[0]
        p_br_s.alignment = PP_ALIGN.RIGHT
        p_br_s.text = suit
        p_br_s.font.size = Pt(14)
        p_br_s.font.color.rgb = suit_color
        p_br_r = tf_br.add_paragraph()
        p_br_r.alignment = PP_ALIGN.RIGHT
        p_br_r.text = rank
        p_br_r.font.name = "Georgia"
        p_br_r.font.size = Pt(18)
        p_br_r.font.bold = True
        p_br_r.font.color.rgb = suit_color

        return card

    # ==========================================================
    # SLIDE 1: Title Slide (Matches Gawain Slide 1)
    # ==========================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_bg(s1, C_HERO_BG)

    # Spaced Author Name
    tb_auth = s1.shapes.add_textbox(Inches(0.85), Inches(4.3), Inches(11.5), Inches(0.6))
    tf_a = tb_auth.text_frame
    tf_a.word_wrap = True
    p_a = tf_a.paragraphs[0]
    p_a.text = "A L I C E   W A L K E R"
    p_a.font.name = "Segoe UI"
    p_a.font.size = Pt(14)
    p_a.font.bold = True
    p_a.font.color.rgb = C_OFFWHITE

    # Big Display Title
    tb_title = s1.shapes.add_textbox(Inches(0.8), Inches(4.75), Inches(11.5), Inches(1.8))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = "The Color Purple"
    p_t.font.name = "Georgia"
    p_t.font.size = Pt(56)
    p_t.font.bold = True
    p_t.font.italic = True
    p_t.font.color.rgb = C_OFFWHITE

    # Small subtitle
    p_sub = tf_t.add_paragraph()
    p_sub.text = "A Critical Analysis of the Novel with Deep Focus on Letters 61–69"
    p_sub.font.name = "Segoe UI"
    p_sub.font.size = Pt(13)
    p_sub.font.color.rgb = RGBColor(210, 185, 235)
    p_sub.space_before = Pt(6)

    # ==========================================================
    # SLIDE 2: Reporters Slide (Matches Gawain Slide 2)
    # ==========================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_bg(s2, C_CREAM_BG)

    # Bottom-left label & Title
    tb_rep_lbl = s2.shapes.add_textbox(Inches(0.85), Inches(4.9), Inches(5.5), Inches(0.5))
    tf_rl = tb_rep_lbl.text_frame
    p_rl = tf_rl.paragraphs[0]
    p_rl.text = "G R O U P   R E P O R T I N G"
    p_rl.font.name = "Segoe UI"
    p_rl.font.size = Pt(12)
    p_rl.font.bold = True
    p_rl.font.color.rgb = C_PRIMARY_PURPLE

    tb_rep_title = s2.shapes.add_textbox(Inches(0.8), Inches(5.3), Inches(5.5), Inches(1.4))
    tf_rt = tb_rep_title.text_frame
    p_rt = tf_rt.paragraphs[0]
    p_rt.text = "Reporters"
    p_rt.font.name = "Georgia"
    p_rt.font.size = Pt(52)
    p_rt.font.bold = True
    p_rt.font.italic = True
    p_rt.font.color.rgb = C_PRIMARY_PURPLE

    # Bottom-right reporters column
    tb_names = s2.shapes.add_textbox(Inches(6.8), Inches(5.1), Inches(5.8), Inches(1.8))
    tf_names = tb_names.text_frame
    tf_names.word_wrap = True
    names = [
        "B A R A Q U I E L ,   D A N I L Y N   K R I X T I N",
        "B O R R O M E O ,   K A T H L E E N   A N N",
        "L O N T O C ,   L E I N A R D T",
        "I T   B A C K G R O U N D   &   S Y S T E M S   A N A L Y S I S"
    ]
    for idx, name in enumerate(names):
        p_n = tf_names.add_paragraph() if idx > 0 else tf_names.paragraphs[0]
        p_n.text = name
        p_n.font.name = "Segoe UI"
        p_n.font.size = Pt(12)
        p_n.font.bold = True
        p_n.font.color.rgb = C_PRIMARY_PURPLE if idx < 3 else C_TEXT_MUTED
        p_n.space_after = Pt(4)

    # ==========================================================
    # SLIDE 3: I. Historical Timeline of the Book – Genesis & Publication (Matches Gawain Slide 3)
    # ==========================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_bg(s3, C_CREAM_BG)

    # Left Playing Card & Title
    add_playing_card(s3, Inches(1.2), Inches(1.3), Inches(2.2), Inches(3.3), rank="A", suit="♠", suit_color=C_PRIMARY_PURPLE)

    tb_t_left = s3.shapes.add_textbox(Inches(0.9), Inches(4.8), Inches(2.8), Inches(1.5))
    tf_tl = tb_t_left.text_frame
    tf_tl.word_wrap = True
    p_tl1 = tf_tl.paragraphs[0]
    p_tl1.text = "Historical"
    p_tl1.font.name = "Georgia"
    p_tl1.font.size = Pt(32)
    p_tl1.font.bold = True
    p_tl1.font.italic = True
    p_tl1.font.color.rgb = C_PRIMARY_PURPLE
    p_tl2 = tf_tl.add_paragraph()
    p_tl2.text = "Timeline"
    p_tl2.font.name = "Georgia"
    p_tl2.font.size = Pt(32)
    p_tl2.font.bold = True
    p_tl2.font.italic = True
    p_tl2.font.color.rgb = C_PRIMARY_PURPLE

    # Right Content Area
    tb_sub = s3.shapes.add_textbox(Inches(4.2), Inches(1.15), Inches(8.3), Inches(0.4))
    tf_sub = tb_sub.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "GENESIS, COMPOSITION & 1982 PUBLICATION OF THE BOOK."
    p_sub.font.name = "Segoe UI"
    p_sub.font.size = Pt(11)
    p_sub.font.bold = True
    p_sub.font.color.rgb = C_PRIMARY_PURPLE

    timeline_items_book_genesis = [
        ("c. Late 1970s (The Ancestral Inspiration)", "Alice Walker conceived the novel inspired by the lived oral histories, folk resilience, and struggles of her maternal grandparents in rural Georgia, aiming to give voice to historically silenced Southern Black women."),
        ("1980–1981 (The Northern California Writing Retreat)", "To escape the noise of New York City, Walker moved to a secluded home in Boonville (Mendocino County), California, creating a serene sanctuary so characters Celie, Shug, and Albert could 'visit' and speak in authentic vernacular."),
        ("Spring 1982 (First Edition Publication)", "Published in 1982 by Harcourt Brace Jovanovich as Alice Walker's third novel; instantly hailed as a revolutionary milestone for its epistolary form written entirely in African American Vernacular English (AAVE)."),
        ("1982–1983 (Critical Reception & Nationwide Discourse)", "Sparked an impassioned national literary debate; lauded by Black feminist scholars for uncompromised emotional truth and healing, while stirring dialogue over its raw depiction of domestic patriarchy.")
    ]

    for idx, (date_hdr, desc) in enumerate(timeline_items_book_genesis):
        y_pos = Inches(1.6) + idx * Inches(1.32)
        # Text box
        tb_item = s3.shapes.add_textbox(Inches(4.2), y_pos, Inches(8.3), Inches(1.15))
        tf_i = tb_item.text_frame
        tf_i.word_wrap = True
        tf_i.margin_left = tf_i.margin_top = tf_i.margin_right = tf_i.margin_bottom = 0
        
        p = tf_i.paragraphs[0]
        p.text = "• " + date_hdr + " "
        p.font.name = "Segoe UI"
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.underline = True
        p.font.color.rgb = C_TEXT_DARK

        run = p.add_run()
        run.text = desc
        run.font.bold = False
        run.font.underline = False
        run.font.color.rgb = C_TEXT_DARK

        # Divider line
        div_line = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4.2), y_pos + Inches(1.18), Inches(8.3), Inches(0.018))
        div_line.fill.solid()
        div_line.fill.fore_color.rgb = C_LINE_PURPLE
        div_line.line.fill.background()

    # ==========================================================
    # SLIDE 4: I. Historical Timeline of the Book – Awards, Censorship & Legacy (Matches Gawain Slide 3 style)
    # ==========================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_bg(s4, C_CREAM_BG)

    add_playing_card(s4, Inches(1.2), Inches(1.3), Inches(2.2), Inches(3.3), rank="K", suit="♠", suit_color=C_PRIMARY_PURPLE)

    tb_t_left = s4.shapes.add_textbox(Inches(0.9), Inches(4.8), Inches(2.8), Inches(1.5))
    tf_tl = tb_t_left.text_frame
    tf_tl.word_wrap = True
    p_tl1 = tf_tl.paragraphs[0]
    p_tl1.text = "Book Legacy"
    p_tl1.font.name = "Georgia"
    p_tl1.font.size = Pt(30)
    p_tl1.font.bold = True
    p_tl1.font.italic = True
    p_tl1.font.color.rgb = C_PRIMARY_PURPLE
    p_tl2 = tf_tl.add_paragraph()
    p_tl2.text = "& Milestones"
    p_tl2.font.name = "Georgia"
    p_tl2.font.size = Pt(30)
    p_tl2.font.bold = True
    p_tl2.font.italic = True
    p_tl2.font.color.rgb = C_PRIMARY_PURPLE

    tb_sub = s4.shapes.add_textbox(Inches(4.2), Inches(1.15), Inches(8.3), Inches(0.4))
    tf_sub = tb_sub.text_frame
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = "PULITZER TRIUMPH, CENSORSHIP BATTLES & GLOBAL IMPACT (1983–PRESENT)."
    p_sub.font.name = "Segoe UI"
    p_sub.font.size = Pt(11)
    p_sub.font.bold = True
    p_sub.font.color.rgb = C_PRIMARY_PURPLE

    timeline_items_book_legacy = [
        ("1983 (Historic Pulitzer Prize & National Book Award)", "Alice Walker made history as the first African-American woman to win the Pulitzer Prize for Fiction; also co-awarded the National Book Award for Fiction, establishing the novel in the permanent global canon."),
        ("1984–1990s (Banning & School Censorship Challenges)", "Ranked continuously on the American Library Association's Most Frequently Challenged Books list due to its frank treatment of race, sexuality, and domestic violence, sparking landmark First Amendment defenses."),
        ("1985 & 2005 (Global Cinematic & Broadway Transposition)", "Adapted into Steven Spielberg's 11-time Oscar-nominated film (1985) and an 11-time Tony-nominated Broadway musical (2005) produced by Oprah Winfrey and Quincy Jones, expanding its cultural reach to millions."),
        ("2015–Present (Broadway Revival, Film Musical & 40th Anniversary)", "The 2015 Broadway revival won the Tony Award for Best Revival of a Musical; a 2023 Warner Bros musical feature film was released; over 15 million copies sold in 25+ languages worldwide.")
    ]

    for idx, (date_hdr, desc) in enumerate(timeline_items_book_legacy):
        y_pos = Inches(1.6) + idx * Inches(1.32)
        tb_item = s4.shapes.add_textbox(Inches(4.2), y_pos, Inches(8.3), Inches(1.15))
        tf_i = tb_item.text_frame
        tf_i.word_wrap = True
        tf_i.margin_left = tf_i.margin_top = tf_i.margin_right = tf_i.margin_bottom = 0
        
        p = tf_i.paragraphs[0]
        p.text = "• " + date_hdr + " "
        p.font.name = "Segoe UI"
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.underline = True
        p.font.color.rgb = C_TEXT_DARK

        run = p.add_run()
        run.text = desc
        run.font.bold = False
        run.font.underline = False
        run.font.color.rgb = C_TEXT_DARK

        div_line = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4.2), y_pos + Inches(1.18), Inches(8.3), Inches(0.018))
        div_line.fill.solid()
        div_line.fill.fore_color.rgb = C_LINE_PURPLE
        div_line.line.fill.background()

    # ==========================================================
    # SLIDE 5: II. Conventions on The School of Thought – Core Conventions (Matches Gawain Slide 4)
    # ==========================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_bg(s5, C_CREAM_BG)

    # Title Left
    tb_title = s5.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(8.0), Inches(1.2))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p1 = tf_t.paragraphs[0]
    p1.text = "Conventions on"
    p1.font.name = "Georgia"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.italic = True
    p1.font.color.rgb = C_PRIMARY_PURPLE
    p2 = tf_t.add_paragraph()
    p2.text = "The School of Thought"
    p2.font.name = "Georgia"
    p2.font.size = Pt(36)
    p2.font.bold = True
    p2.font.italic = True
    p2.font.color.rgb = C_PRIMARY_PURPLE

    # Subtitle
    tb_sub = s5.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(8.0), Inches(0.4))
    tf_s = tb_sub.text_frame
    p_s = tf_s.paragraphs[0]
    p_s.text = "CORE CONVENTIONS: WOMANISM"
    p_s.font.name = "Segoe UI"
    p_s.font.size = Pt(11)
    p_s.font.bold = True
    p_s.font.color.rgb = C_PRIMARY_PURPLE

    # Bullet content
    tb_body = s5.shapes.add_textbox(Inches(1.0), Inches(2.7), Inches(7.8), Inches(3.2))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True
    tf_b.margin_left = tf_b.margin_top = tf_b.margin_right = tf_b.margin_bottom = 0

    core_pts = [
        ("Black Women's Experience", "Walker centers the interior lives, struggles, and voices of marginalized rural Southern Black women."),
        ("Intersectional Outlook", "Analyzes race, socioeconomic class, and gender simultaneously, expanding mainstream white feminism."),
        ("Communal Wholeness & Non-Separatism", "Committed to the survival and healing of an entire people—both women and men; rejects discarding men in favor of moral redemption."),
        ("Female Solidarity & Erotic Autonomy", "Values female bonding, sisterly mentorship, and same-sex romantic love (Celie and Shug) as sacred forces of healing.")
    ]

    for idx, (label, desc) in enumerate(core_pts):
        p = tf_b.add_paragraph() if idx > 0 else tf_b.paragraphs[0]
        p.text = f"{label} – {desc}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = C_TEXT_DARK
        p.space_after = Pt(10)
        p.runs[0].font.bold = True

    # Star conclusion
    tb_star = s5.shapes.add_textbox(Inches(1.0), Inches(6.0), Inches(7.8), Inches(0.6))
    tf_star = tb_star.text_frame
    p_star = tf_star.paragraphs[0]
    p_star.text = "★ \"Womanist is to feminist as purple is to lavender.\" — Alice Walker (1983)"
    p_star.font.name = "Segoe UI"
    p_star.font.size = Pt(11.5)
    p_star.font.bold = True
    p_star.font.color.rgb = C_PRIMARY_PURPLE

    # Right Playing Card
    add_playing_card(s5, Inches(9.8), Inches(1.2), Inches(2.6), Inches(4.8), rank="Q", suit="♥", suit_color=C_ACCENT_BURGUNDY)

    # ==========================================================
    # SLIDE 6: II. Conventions on The School of Thought – Literary Conventions (Matches Gawain Slide 5)
    # ==========================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_bg(s6, C_CREAM_BG)

    tb_title = s6.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(8.0), Inches(1.2))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p1 = tf_t.paragraphs[0]
    p1.text = "Conventions on"
    p1.font.name = "Georgia"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.italic = True
    p1.font.color.rgb = C_PRIMARY_PURPLE
    p2 = tf_t.add_paragraph()
    p2.text = "The School of Thought"
    p2.font.name = "Georgia"
    p2.font.size = Pt(36)
    p2.font.bold = True
    p2.font.italic = True
    p2.font.color.rgb = C_PRIMARY_PURPLE

    tb_sub = s6.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(8.0), Inches(0.4))
    tf_s = tb_sub.text_frame
    p_s = tf_s.paragraphs[0]
    p_s.text = "LITERARY CONVENTIONS & AESTHETIC FORM"
    p_s.font.name = "Segoe UI"
    p_s.font.size = Pt(11)
    p_s.font.bold = True
    p_s.font.color.rgb = C_PRIMARY_PURPLE

    tb_body = s6.shapes.add_textbox(Inches(1.0), Inches(2.7), Inches(7.8), Inches(3.2))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True
    tf_b.margin_left = tf_b.margin_top = tf_b.margin_right = tf_b.margin_bottom = 0

    lit_pts = [
        ("Subversion of Epistolary Form", "Adapts the traditional European epistolary novel for a rural, silenced Black girl, creating an unmediated sanctuary for trauma and awakening."),
        ("African American Vernacular English (AAVE)", "Rejects formal Standard English narration, validating Southern Black folk speech as an authentic, grammatically regular, and poetic literary language."),
        ("The Pivotal Header Shift (Letter 69)", "Progressing from 'Dear God' to 'Dear Nettie' marks Celie's transition from passive victimhood to active relational agency."),
        ("Symbolist Folk Artistry", "Employs communal folk crafts (quilting 'Sister's Choice' and sewing 'Folkspants') as visual metaphors for reconstruction, labor dignity, and autonomy.")
    ]

    for idx, (label, desc) in enumerate(lit_pts):
        p = tf_b.add_paragraph() if idx > 0 else tf_b.paragraphs[0]
        p.text = f"{label} – {desc}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = C_TEXT_DARK
        p.space_after = Pt(10)
        p.runs[0].font.bold = True

    tb_star = s6.shapes.add_textbox(Inches(1.0), Inches(6.0), Inches(7.8), Inches(0.6))
    tf_star = tb_star.text_frame
    p_star = tf_star.paragraphs[0]
    p_star.text = "★ In The Color Purple, writing is an instrument of self-definition, historical recovery, and survival."
    p_star.font.name = "Segoe UI"
    p_star.font.size = Pt(11)
    p_star.font.bold = True
    p_star.font.color.rgb = C_PRIMARY_PURPLE

    add_playing_card(s6, Inches(9.8), Inches(1.2), Inches(2.6), Inches(4.8), rank="J", suit="♠", suit_color=C_PRIMARY_PURPLE)

    # ==========================================================
    # SLIDE 7: II. Conventions on The School of Thought – Panentheism & Postcolonialism
    # ==========================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_bg(s7, C_CREAM_BG)

    tb_title = s7.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(8.0), Inches(1.2))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    p1 = tf_t.paragraphs[0]
    p1.text = "Conventions on"
    p1.font.name = "Georgia"
    p1.font.size = Pt(36)
    p1.font.bold = True
    p1.font.italic = True
    p1.font.color.rgb = C_PRIMARY_PURPLE
    p2 = tf_t.add_paragraph()
    p2.text = "The School of Thought"
    p2.font.name = "Georgia"
    p2.font.size = Pt(36)
    p2.font.bold = True
    p2.font.italic = True
    p2.font.color.rgb = C_PRIMARY_PURPLE

    tb_sub = s7.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(8.0), Inches(0.4))
    tf_s = tb_sub.text_frame
    p_s = tf_s.paragraphs[0]
    p_s.text = "PANENTHEISM & POSTCOLONIAL CONVENTIONS"
    p_s.font.name = "Segoe UI"
    p_s.font.size = Pt(11)
    p_s.font.bold = True
    p_s.font.color.rgb = C_PRIMARY_PURPLE

    tb_body = s7.shapes.add_textbox(Inches(1.0), Inches(2.7), Inches(7.8), Inches(3.2))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True
    tf_b.margin_left = tf_b.margin_top = tf_b.margin_right = tf_b.margin_bottom = 0

    pan_pts = [
        ("Theological Panentheism", "Replaces the distant white patriarchal God with an immanent divine spirit ('It') living inside nature, trees, birds, wind, and human affection."),
        ("Theology of Admiration", "God is not an angry monarch demanding terror; God desires shared wonder: 'It pisses God off if you walk by the color purple in a field somewhere and don't notice it.'"),
        ("Postcolonial Anti-Imperialism", "Nettie's African narrative critiques British corporate exploitation of the Olinka (clearing the sacred roofleaf for rubber, imposing taxes)."),
        ("Transatlantic Counterpoint", "Walker mirrors the domestic abuse of Black women in Georgia with the imperialist devastation of African tribes, revealing linked global structures.")
    ]

    for idx, (label, desc) in enumerate(pan_pts):
        p = tf_b.add_paragraph() if idx > 0 else tf_b.paragraphs[0]
        p.text = f"{label} – {desc}"
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.color.rgb = C_TEXT_DARK
        p.space_after = Pt(10)
        p.runs[0].font.bold = True

    tb_star = s7.shapes.add_textbox(Inches(1.0), Inches(6.0), Inches(7.8), Inches(0.6))
    tf_star = tb_star.text_frame
    p_star = tf_star.paragraphs[0]
    p_star.text = "★ Spiritual liberation requires dismantling external idols and rediscovering divine joy in nature."
    p_star.font.name = "Segoe UI"
    p_star.font.size = Pt(11)
    p_star.font.bold = True
    p_star.font.color.rgb = C_PRIMARY_PURPLE

    add_playing_card(s7, Inches(9.8), Inches(1.2), Inches(2.6), Inches(4.8), rank="A", suit="♥", suit_color=C_ACCENT_BURGUNDY)

    # ==========================================================
    # SLIDE 8: III. Author's Biography (Early Life) (Matches Gawain Slide 6)
    # ==========================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_bg(s8, C_CREAM_BG)

    # Bottom solid band (like Gawain green band)
    b_band = s8.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(6.4), Inches(13.333), Inches(1.1))
    b_band.fill.solid()
    b_band.fill.fore_color.rgb = C_PRIMARY_PURPLE
    b_band.line.fill.background()

    # Center Icon (Quill/Book)
    tb_icon = s8.shapes.add_textbox(Inches(5.666), Inches(0.8), Inches(2.0), Inches(1.0))
    tf_ic = tb_icon.text_frame
    p_ic = tf_ic.paragraphs[0]
    p_ic.alignment = PP_ALIGN.CENTER
    p_ic.text = "✒"
    p_ic.font.size = Pt(44)
    p_ic.font.color.rgb = C_PRIMARY_PURPLE

    # Title & Author
    tb_bio_t = s8.shapes.add_textbox(Inches(2.0), Inches(1.8), Inches(9.333), Inches(1.2))
    tf_bt = tb_bio_t.text_frame
    tf_bt.word_wrap = True
    p_bt1 = tf_bt.paragraphs[0]
    p_bt1.alignment = PP_ALIGN.CENTER
    p_bt1.text = "Author's Biography"
    p_bt1.font.name = "Georgia"
    p_bt1.font.size = Pt(36)
    p_bt1.font.bold = True
    p_bt1.font.italic = True
    p_bt1.font.color.rgb = C_PRIMARY_PURPLE
    
    p_bt2 = tf_bt.add_paragraph()
    p_bt2.alignment = PP_ALIGN.CENTER
    p_bt2.text = "A L I C E   W A L K E R"
    p_bt2.font.name = "Segoe UI"
    p_bt2.font.size = Pt(13)
    p_bt2.font.bold = True
    p_bt2.font.color.rgb = C_PRIMARY_PURPLE
    p_bt2.space_before = Pt(4)

    # Bio text block
    tb_bio_txt = s8.shapes.add_textbox(Inches(1.5), Inches(3.2), Inches(10.333), Inches(2.8))
    tf_bx = tb_bio_txt.text_frame
    tf_bx.word_wrap = True
    p_bx = tf_bx.paragraphs[0]
    p_bx.text = (
        "ALICE WALKER WAS BORN ON FEBRUARY 9, 1944, IN EATONTON, PUTNAM COUNTY, GEORGIA, THE EIGHTH CHILD "
        "OF WILLIE LEE AND MINNIE TALLULAH GRANT WALKER, WHO LABORED AS TENANT FARMERS AND SHARECROPPERS. "
        "DESPITE SEVERE ECONOMIC HARDSHIP, HER PARENTS INSTILLED A DEEP REVERENCE FOR NATURE, ART, BEAUTY, "
        "AND EDUCATION. AT AGE EIGHT, HER BROTHER ACCIDENTALLY SHOT HER IN THE RIGHT EYE WITH A BB GUN, "
        "LEAVING A PERMANENT SCAR AND CAUSING SEVERE INTROSPECTION THAT DROVE HER INTO A WORLD OF READING "
        "AND POETRY. AFTER SURGERY RESTORED HER CONFIDENCE AT FOURTEEN, SHE GRADUATED AS VALEDICTORIAN "
        "AND HOMECOMING QUEEN, ATTENDING SPELMAN COLLEGE IN ATLANTA UNDER MENTORS HOWARD ZINN AND STAUGHTON LYND, "
        "LATER GRADUATING FROM SARAH LAWRENCE COLLEGE IN 1965."
    )
    p_bx.font.name = "Segoe UI"
    p_bx.font.size = Pt(11)
    p_bx.font.color.rgb = C_TEXT_DARK
    p_bx.line_spacing = 1.35
    p_bx.alignment = PP_ALIGN.JUSTIFY

    # ==========================================================
    # SLIDE 9: III. Author's Biography – Activism & Legacy (Matches Gawain Slide 7)
    # ==========================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_bg(s9, C_CREAM_BG)

    b_band = s9.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(6.4), Inches(13.333), Inches(1.1))
    b_band.fill.solid()
    b_band.fill.fore_color.rgb = C_PRIMARY_PURPLE
    b_band.line.fill.background()

    tb_icon = s9.shapes.add_textbox(Inches(5.666), Inches(0.8), Inches(2.0), Inches(1.0))
    tf_ic = tb_icon.text_frame
    p_ic = tf_ic.paragraphs[0]
    p_ic.alignment = PP_ALIGN.CENTER
    p_ic.text = "★"
    p_ic.font.size = Pt(40)
    p_ic.font.color.rgb = C_PRIMARY_PURPLE

    tb_bio_t = s9.shapes.add_textbox(Inches(2.0), Inches(1.8), Inches(9.333), Inches(1.2))
    tf_bt = tb_bio_t.text_frame
    tf_bt.word_wrap = True
    p_bt1 = tf_bt.paragraphs[0]
    p_bt1.alignment = PP_ALIGN.CENTER
    p_bt1.text = "Author's Biography"
    p_bt1.font.name = "Georgia"
    p_bt1.font.size = Pt(36)
    p_bt1.font.bold = True
    p_bt1.font.italic = True
    p_bt1.font.color.rgb = C_PRIMARY_PURPLE
    
    p_bt2 = tf_bt.add_paragraph()
    p_bt2.alignment = PP_ALIGN.CENTER
    p_bt2.text = "CIVIL RIGHTS ACTIVISM, SCHOLARSHIP & LITERARY RECOGNITION"
    p_bt2.font.name = "Segoe UI"
    p_bt2.font.size = Pt(11)
    p_bt2.font.bold = True
    p_bt2.font.color.rgb = C_PRIMARY_PURPLE
    p_bt2.space_before = Pt(4)

    tb_bio_txt = s9.shapes.add_textbox(Inches(1.5), Inches(3.2), Inches(10.333), Inches(2.8))
    tf_bx = tb_bio_txt.text_frame
    tf_bx.word_wrap = True
    p_bx = tf_bx.paragraphs[0]
    p_bx.text = (
        "WALKER BECAME DEEPLY ENGAGED IN THE CIVIL RIGHTS MOVEMENT, PARTICIPATING IN MISSISSIPPI VOTER "
        "REGISTRATION DRIVES AND TAKING DEPOSITIONS FOR THE NAACP LEGAL DEFENSE FUND. IN 1967 SHE MARRIED "
        "CIVIL RIGHTS LAWYER MELVYN LEVENTHAL, LIVING UNDER THREATS FROM THE KU KLUX KLAN. IN 1975, HER "
        "SEMINAL ESSAY 'IN SEARCH OF ZORA NEALE HURSTON' SINGLE-HANDEDLY RESURRECTED HURSTON'S REPUTATION "
        "AS A TITAN OF AMERICAN LITERATURE, PURCHASING A HEADSTONE FOR HER UNMARKED GRAVE READING 'A GENIUS "
        "OF THE SOUTH'. IN 1982, SHE PUBLISHED HER THIRD NOVEL, THE COLOR PURPLE, WINNING BOTH THE PULITZER "
        "PRIZE FOR FICTION AND THE NATIONAL BOOK AWARD IN 1983—BECOMING THE FIRST AFRICAN-AMERICAN WOMAN TO WIN "
        "THE PULITZER PRIZE FOR FICTION."
    )
    p_bx.font.name = "Segoe UI"
    p_bx.font.size = Pt(11)
    p_bx.font.color.rgb = C_TEXT_DARK
    p_bx.line_spacing = 1.35
    p_bx.alignment = PP_ALIGN.JUSTIFY

    # ==========================================================
    # SLIDE 10: IV. Summary of The Work – Breakdown Card Slide (Matches Gawain Slide 8)
    # ==========================================================
    s10 = prs.slides.add_slide(blank_layout)
    # Split slide: top half deep purple, bottom half cream!
    s10_top = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(4.5))
    s10_top.fill.solid()
    s10_top.fill.fore_color.rgb = C_HERO_BG
    s10_top.line.fill.background()

    s10_bot = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(4.5), Inches(13.333), Inches(3.0))
    s10_bot.fill.solid()
    s10_bot.fill.fore_color.rgb = C_CREAM_BG
    s10_bot.line.fill.background()

    # 4 Cards in top half
    card_ranks = [("A", "♠", "CONTEXT (LETTERS 1–60)", "Primary Text: Georgia Life & Abuse"),
                  ("2", "♠", "SEC. 6 (LETTERS 61–65)", "SparkNotes: Hidden Trunk & Odyssey"),
                  ("3", "♣", "SEC. 6 (LETTERS 66–68)", "SparkNotes: Olinka Roofleaf & Tin"),
                  ("4", "♣", "SEC. 6 (LETTERS 68–69)", "SparkNotes: Paternity & 'Dear Nettie'")]

    for idx, (rk, st, p_label, p_desc) in enumerate(card_ranks):
        c_left = Inches(1.2) + idx * Inches(2.8)
        card = add_playing_card(s10, c_left, Inches(0.8), Inches(2.2), Inches(3.0), rank=rk, suit=st, suit_color=C_PRIMARY_PURPLE)
        
        # Label below card
        tb_lbl = s10.shapes.add_textbox(c_left - Inches(0.2), Inches(3.9), Inches(2.6), Inches(0.5))
        tf_l = tb_lbl.text_frame
        p_l = tf_l.paragraphs[0]
        p_l.alignment = PP_ALIGN.CENTER
        p_l.text = p_label
        p_l.font.name = "Segoe UI"
        p_l.font.size = Pt(8.5)
        p_l.font.bold = True
        p_l.font.color.rgb = C_OFFWHITE

    # Bottom Half Title
    tb_bot_title = s10.shapes.add_textbox(Inches(1.0), Inches(4.85), Inches(11.333), Inches(2.1))
    tf_b = tb_bot_title.text_frame
    tf_b.word_wrap = True
    p_b1 = tf_b.paragraphs[0]
    p_b1.alignment = PP_ALIGN.CENTER
    p_b1.text = "Summary Of The Work"
    p_b1.font.name = "Georgia"
    p_b1.font.size = Pt(40)
    p_b1.font.bold = True
    p_b1.font.italic = True
    p_b1.font.color.rgb = C_PRIMARY_PURPLE

    p_b2 = tf_b.add_paragraph()
    p_b2.alignment = PP_ALIGN.CENTER
    p_b2.text = "BASED ON SPARKNOTES SECTION 6 (LETTERS 61–69) & PRIMARY NOVEL TEXT"
    p_b2.font.name = "Segoe UI"
    p_b2.font.size = Pt(11.5)
    p_b2.font.bold = True
    p_b2.font.color.rgb = C_PRIMARY_PURPLE
    p_b2.space_before = Pt(6)

    # ==========================================================
    # SLIDE 11: IV. Summary – Part I: Background Context (Letters 1–60)
    # ==========================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_bg(s11, C_CREAM_BG)

    # Top header
    tb_hdr = s11.shapes.add_textbox(Inches(0.85), Inches(0.5), Inches(11.5), Inches(0.95))
    tf_h = tb_hdr.text_frame
    p_h1 = tf_h.paragraphs[0]
    p_h1.text = "Part I. Contextual Background: Letters 1–60 (Primary Novel Text)"
    p_h1.font.name = "Georgia"
    p_h1.font.size = Pt(22)
    p_h1.font.bold = True
    p_h1.font.italic = True
    p_h1.font.color.rgb = C_PRIMARY_PURPLE

    p_h2 = tf_h.add_paragraph()
    p_h2.text = "PRIMARY SOURCE: ALICE WALKER'S NOVEL TEXT — CELIE'S EARLY TRAUMA & AWAKENING IN GEORGIA"
    p_h2.font.name = "Segoe UI"
    p_h2.font.size = Pt(9.5)
    p_h2.font.bold = True
    p_h2.font.color.rgb = C_PRIMARY_PURPLE

    # Divider line
    line = s11.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    # Left Frame / Card
    add_playing_card(s11, Inches(0.85), Inches(1.8), Inches(3.6), Inches(5.1), rank="I", suit="♥", suit_color=C_ACCENT_BURGUNDY)

    # Right Content Points
    tb_pts = s11.shapes.add_textbox(Inches(4.8), Inches(1.8), Inches(7.6), Inches(5.1))
    tf_p = tb_pts.text_frame
    tf_p.word_wrap = True

    pts_p1 = [
        ("Celie's Trauma & Silencing (Letters 1–10)", "Celie, 14, begins writing to God because her stepfather Alphonso abuses her, warns her never to tell anyone, and forcibly gives away her two infants (Olivia and Adam) at birth."),
        ("Chattel Marriage to Albert (Letters 11–25)", "Alphonso trades Celie to Albert (Mr. _____) along with a cow to serve as an unpaid domestic worker and caretaker for his violent children. Nettie flees Albert's advances; Albert vows Celie will never hear from her."),
        ("Sofia's Defiance & Incarceration (Letters 26–45)", "Sofia refuses Harpo's attempts to dominate her; defies the white mayor when asked to be a maid ('Hell no!'), is brutally beaten by police, imprisoned in the laundry, and made the mayor's indentured servant."),
        ("Shug Avery's Transformative Love (Letters 46–60)", "Albert brings home his dying former lover, blues singer Shug Avery. Celie nurses Shug to health; Shug awakens Celie to physical joy, self-worth, and dedicates 'Miss Celie's Song' to her.")
    ]

    for idx, (title_p, desc_p) in enumerate(pts_p1):
        p_t = tf_p.add_paragraph() if idx > 0 else tf_p.paragraphs[0]
        p_t.text = title_p
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = C_PRIMARY_PURPLE
        p_t.space_before = Pt(8) if idx > 0 else Pt(0)

        p_d = tf_p.add_paragraph()
        p_d.text = desc_p
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(2)

    # ==========================================================
    # SLIDE 12: IV. Summary – Part II: Letters 61–65 (SparkNotes Section 6, Part 1)
    # ==========================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_bg(s12, C_CREAM_BG)

    tb_hdr = s12.shapes.add_textbox(Inches(0.85), Inches(0.5), Inches(11.5), Inches(0.95))
    tf_h = tb_hdr.text_frame
    p_h1 = tf_h.paragraphs[0]
    p_h1.text = "Part II. Letters 61–65: The Hidden Letters & Nettie's Odyssey"
    p_h1.font.name = "Georgia"
    p_h1.font.size = Pt(22)
    p_h1.font.bold = True
    p_h1.font.italic = True
    p_h1.font.color.rgb = C_PRIMARY_PURPLE

    p_h2 = tf_h.add_paragraph()
    p_h2.text = "SOURCE: SPARKNOTES SECTION 6 (PART 1) — THE DISCOVERY OF ALBERT'S TRUNK & TRANSATLANTIC MISSION"
    p_h2.font.name = "Segoe UI"
    p_h2.font.size = Pt(9.5)
    p_h2.font.bold = True
    p_h2.font.color.rgb = C_PRIMARY_PURPLE

    line = s12.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    add_playing_card(s12, Inches(0.85), Inches(1.8), Inches(3.6), Inches(5.1), rank="II", suit="♠", suit_color=C_PRIMARY_PURPLE)

    tb_pts = s12.shapes.add_textbox(Inches(4.8), Inches(1.8), Inches(7.6), Inches(5.1))
    tf_p = tb_pts.text_frame
    tf_p.word_wrap = True

    pts_p2 = [
        ("The Intercepted Letters in the Trunk (Letters 61–63)", "Shug spots Albert hiding mail with African stamps in his coat. Decades of Nettie's letters are locked in Albert's trunk under tobacco. Shug steals the key, and Celie steams open the envelopes over a boiling kettle."),
        ("Nettie's Escape Recounted (Letter 64)", "Nettie's first letter reveals Albert chased her on horseback, attempting rape; Nettie fought him off. In revenge, Albert swore Celie would never hear from her again."),
        ("The Miracle of Celie's Children (Letters 64–65)", "Nettie sought shelter with Reverend Samuel and Corrine, discovering their adopted children, Olivia and Adam, are Celie's stolen babies! Nettie joins them as a missionary to care for her niece and nephew."),
        ("Transatlantic Voyage & African Arrival (Letter 65)", "Nettie marvels at Harlem's Black pride; visits British museums filled with looted African art; arrives in Senegal and Monrovia, trekking 4 days into the bush to reach the Olinka village.")
    ]

    for idx, (title_p, desc_p) in enumerate(pts_p2):
        p_t = tf_p.add_paragraph() if idx > 0 else tf_p.paragraphs[0]
        p_t.text = title_p
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = C_PRIMARY_PURPLE
        p_t.space_before = Pt(8) if idx > 0 else Pt(0)

        p_d = tf_p.add_paragraph()
        p_d.text = desc_p
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(2)

    # ==========================================================
    # SLIDE 13: IV. Summary – Part III: Letters 66–68 (SparkNotes Section 6, Part 2)
    # ==========================================================
    s13 = prs.slides.add_slide(blank_layout)
    set_bg(s13, C_CREAM_BG)

    tb_hdr = s13.shapes.add_textbox(Inches(0.85), Inches(0.5), Inches(11.5), Inches(0.95))
    tf_h = tb_hdr.text_frame
    p_h1 = tf_h.paragraphs[0]
    p_h1.text = "Part III. Letters 66–68: Olinka Culture, Roofleaf & Imperial Destruction"
    p_h1.font.name = "Georgia"
    p_h1.font.size = Pt(22)
    p_h1.font.bold = True
    p_h1.font.italic = True
    p_h1.font.color.rgb = C_PRIMARY_PURPLE

    p_h2 = tf_h.add_paragraph()
    p_h2.text = "SOURCE: SPARKNOTES SECTION 6 (PART 2) — THE SACRED ROOFLEAF, BRITISH RUBBER ROAD & CORRINE'S PEACE"
    p_h2.font.name = "Segoe UI"
    p_h2.font.size = Pt(9.5)
    p_h2.font.bold = True
    p_h2.font.color.rgb = C_PRIMARY_PURPLE

    line = s13.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    add_playing_card(s13, Inches(0.85), Inches(1.8), Inches(3.6), Inches(5.1), rank="III", suit="♣", suit_color=C_PRIMARY_PURPLE)

    tb_pts = s13.shapes.add_textbox(Inches(4.8), Inches(1.8), Inches(7.6), Inches(5.1))
    tf_p = tb_pts.text_frame
    tf_p.word_wrap = True

    pts_p3 = [
        ("The Sacred Roofleaf Deity (Letter 66)", "The Olinka worship the protective roofleaf that covers their huts, originating from an ancient disaster when a greedy chief traded roofleaf land to white men and a hurricane nearly wiped out the village."),
        ("Olinka Gender Rigidity (Letter 67)", "Olinka men bar girls from education ('a girl is nothing to herself, only to her husband'). Tashi secretly studies in Nettie's hut with Olivia at night, highlighting patriarchal oppression across continents."),
        ("Colonial Road & Erasure of Sacred Space (Letter 68)", "An English rubber company buys the territory from afar. Armed roadbuilders bulldoze right through Catherine's yam fields and huts, destroying every stalk of sacred roofleaf."),
        ("Corrugated Tin Defeat & Corrine's Death (Letter 68)", "Forced to buy sweltering corrugated tin roofs and pay water taxes on their own streams, Olinka women wail in defeat. Corrine, suspecting Nettie, recognizes Celie's town quilt, whispers 'I believe,' and dies at peace.")
    ]

    for idx, (title_p, desc_p) in enumerate(pts_p3):
        p_t = tf_p.add_paragraph() if idx > 0 else tf_p.paragraphs[0]
        p_t.text = title_p
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = C_PRIMARY_PURPLE
        p_t.space_before = Pt(8) if idx > 0 else Pt(0)

        p_d = tf_p.add_paragraph()
        p_d.text = desc_p
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(2)

    # ==========================================================
    # SLIDE 14: IV. Summary – Part IV: Letters 68–69 (SparkNotes Section 6, Part 3)
    # ==========================================================
    s14 = prs.slides.add_slide(blank_layout)
    set_bg(s14, C_CREAM_BG)

    tb_hdr = s14.shapes.add_textbox(Inches(0.85), Inches(0.5), Inches(11.5), Inches(0.95))
    tf_h = tb_hdr.text_frame
    p_h1 = tf_h.paragraphs[0]
    p_h1.text = "Part IV. Letters 68–69: Paternity Revelation, Sublimation & 'Dear Nettie'"
    p_h1.font.name = "Georgia"
    p_h1.font.size = Pt(22)
    p_h1.font.bold = True
    p_h1.font.italic = True
    p_h1.font.color.rgb = C_PRIMARY_PURPLE

    p_h2 = tf_h.add_paragraph()
    p_h2.text = "SOURCE: SPARKNOTES SECTION 6 (PART 3) — PATERNITY TRUTH, REFACTORING RAGE & THEOLOGICAL LIBERATION"
    p_h2.font.name = "Segoe UI"
    p_h2.font.size = Pt(9.5)
    p_h2.font.bold = True
    p_h2.font.color.rgb = C_PRIMARY_PURPLE

    line = s14.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.5), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    add_playing_card(s14, Inches(0.85), Inches(1.8), Inches(3.6), Inches(5.1), rank="IV", suit="♦", suit_color=C_ACCENT_BURGUNDY)

    tb_pts = s14.shapes.add_textbox(Inches(4.8), Inches(1.8), Inches(7.6), Inches(5.1))
    tf_p = tb_pts.text_frame
    tf_p.word_wrap = True

    pts_p4 = [
        ("The Paternity Truth: 'Pa is Not Our Pa!' (Letter 68)", "Samuel reveals Celie's real father was an industrious, prosperous Black merchant/farmer whose store was burned and who was lynched by white competitors. Alphonso usurped the property and traumatized mother. Incest shame is lifted!"),
        ("A Needle and Not a Razor (Letter 68)", "Furious at Albert's cruelty, Celie contemplates slitting his throat with his shaving razor. Shug intervenes: channeling Celie's murderous rage into sewing custom pants, planting the seeds for 'Folkspants, Unlimited'."),
        ("The Epistolary Address Shift (Letter 69)", "Celie renounces the patriarchal white God: 'What God do for me? ... The God I been praying to is a man ... Trifling, forgitful and lowdown.' Letter 69 officially begins: 'DEAR NETTIE'."),
        ("Panentheism & The Color Purple (Letter 69)", "Shug explains God as an immanent 'It' present in nature and human joy: 'I think it pisses God off if you walk by the color purple in a field somewhere and don't notice it.' Celie leaves with Shug for Memphis.")
    ]

    for idx, (title_p, desc_p) in enumerate(pts_p4):
        p_t = tf_p.add_paragraph() if idx > 0 else tf_p.paragraphs[0]
        p_t.text = title_p
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(11.5)
        p_t.font.bold = True
        p_t.font.color.rgb = C_PRIMARY_PURPLE
        p_t.space_before = Pt(8) if idx > 0 else Pt(0)

        p_d = tf_p.add_paragraph()
        p_d.text = desc_p
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(2)

    # ==========================================================
    # SLIDE 15: V. Analysis of The Literary Work – Divider (Matches Gawain Slide 26)
    # ==========================================================
    s15 = prs.slides.add_slide(blank_layout)
    set_bg(s15, C_HERO_BG)

    tb_an_t = s15.shapes.add_textbox(Inches(1.0), Inches(2.8), Inches(11.333), Inches(2.2))
    tf_at = tb_an_t.text_frame
    tf_at.word_wrap = True
    p1 = tf_at.paragraphs[0]
    p1.alignment = PP_ALIGN.CENTER
    p1.text = "Analysis of The Literary Work"
    p1.font.name = "Georgia"
    p1.font.size = Pt(48)
    p1.font.bold = True
    p1.font.italic = True
    p1.font.color.rgb = C_OFFWHITE

    p2 = tf_at.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    p2.text = "T H E   C O L O R   P U R P L E"
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(14)
    p2.font.bold = True
    p2.font.color.rgb = C_GOLD
    p2.space_before = Pt(8)

    p3 = tf_at.add_paragraph()
    p3.alignment = PP_ALIGN.CENTER
    p3.text = "Setting, Character Psychology, Dialect & Deep Symbolic Systems"
    p3.font.name = "Segoe UI"
    p3.font.size = Pt(12)
    p3.font.color.rgb = RGBColor(210, 190, 230)
    p3.space_before = Pt(4)

    # ==========================================================
    # SLIDE 16: V. Analysis – Setting Analysis (Matches Gawain Slide 27/28)
    # ==========================================================
    s16 = prs.slides.add_slide(blank_layout)
    set_bg(s16, C_CREAM_BG)

    tb_hdr = s16.shapes.add_textbox(Inches(0.85), Inches(0.6), Inches(11.5), Inches(0.6))
    tf_h = tb_hdr.text_frame
    p_h = tf_h.paragraphs[0]
    p_h.text = "Setting Analysis: The Dual Transatlantic Landscapes"
    p_h.font.name = "Georgia"
    p_h.font.size = Pt(24)
    p_h.font.bold = True
    p_h.font.italic = True
    p_h.font.color.rgb = C_PRIMARY_PURPLE

    line = s16.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.3), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    # Left Card: Rural Georgia
    c1 = s16.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.85), Inches(1.6), Inches(5.6), Inches(5.2))
    c1.fill.solid()
    c1.fill.fore_color.rgb = C_WHITE
    c1.line.color.rgb = C_PRIMARY_PURPLE
    c1.line.width = Pt(1.5)

    tb_c1 = s16.shapes.add_textbox(Inches(1.1), Inches(1.8), Inches(5.1), Inches(4.7))
    tf_c1 = tb_c1.text_frame
    tf_c1.word_wrap = True
    p_c1_t = tf_c1.paragraphs[0]
    p_c1_t.text = "Rural Georgia: Domestic Isolation & Jim Crow"
    p_c1_t.font.name = "Georgia"
    p_c1_t.font.size = Pt(15)
    p_c1_t.font.bold = True
    p_c1_t.font.color.rgb = C_PRIMARY_PURPLE

    pts_ga = [
        ("The Sharecropping Plantation", "Isolated homesteads surrounded by cotton fields, dirt roads, and outdoor springs. The domestic sphere operates under male tyranny and total physical isolation."),
        ("Pervasive Racial Terror", "Lynching, arbitrary police brutality (Sofia's beating), and white economic domination prevent Black institutional security."),
        ("Sanctuary Spaces", "Private bedrooms, the porch, and Harpo's jukejoint operate as vital liminal spaces where Black music, community, and female intimacy flourish.")
    ]
    for bold_k, text_v in pts_ga:
        p_item = tf_c1.add_paragraph()
        p_item.text = f"• {bold_k}: {text_v}"
        p_item.font.name = "Segoe UI"
        p_item.font.size = Pt(10.5)
        p_item.font.color.rgb = C_TEXT_DARK
        p_item.space_before = Pt(8)
        p_item.runs[0].font.bold = True

    # Right Card: The Olinka Village
    c2 = s16.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.85), Inches(1.6), Inches(5.6), Inches(5.2))
    c2.fill.solid()
    c2.fill.fore_color.rgb = C_WHITE
    c2.line.color.rgb = C_PRIMARY_PURPLE
    c2.line.width = Pt(1.5)

    tb_c2 = s16.shapes.add_textbox(Inches(7.1), Inches(1.8), Inches(5.1), Inches(4.7))
    tf_c2 = tb_c2.text_frame
    tf_c2.word_wrap = True
    p_c2_t = tf_c2.paragraphs[0]
    p_c2_t.text = "Olinka Village: Communal Harmony & Colonization"
    p_c2_t.font.name = "Georgia"
    p_c2_t.font.size = Pt(15)
    p_c2_t.font.bold = True
    p_c2_t.font.color.rgb = C_PRIMARY_PURPLE

    pts_ol = [
        ("Ancestral Symbiosis", "Round mud huts thatched with sacred roofleaf, rich cassava and yam fields, and communal songs honoring nature's balance."),
        ("Indigenous Patriarchy", "Traditional gender segregation where girls are denied schooling and women submit to polygamous husbands with life-or-death power."),
        ("Corporate Bulldozing", "The arrival of the English rubber company road dismantles huts, trees, and water rights—replacing organic roofleaf with scorching corrugated tin.")
    ]
    for bold_k, text_v in pts_ol:
        p_item = tf_c2.add_paragraph()
        p_item.text = f"• {bold_k}: {text_v}"
        p_item.font.name = "Segoe UI"
        p_item.font.size = Pt(10.5)
        p_item.font.color.rgb = C_TEXT_DARK
        p_item.space_before = Pt(8)
        p_item.runs[0].font.bold = True

    # ==========================================================
    # SLIDE 17: V. Analysis – Character Transformation (Matches Gawain Slide 29)
    # ==========================================================
    s17 = prs.slides.add_slide(blank_layout)
    set_bg(s17, C_CREAM_BG)

    tb_hdr = s17.shapes.add_textbox(Inches(0.85), Inches(0.6), Inches(11.5), Inches(0.6))
    tf_h = tb_hdr.text_frame
    p_h = tf_h.paragraphs[0]
    p_h.text = "Character Psychology & Relational Transformations"
    p_h.font.name = "Georgia"
    p_h.font.size = Pt(24)
    p_h.font.bold = True
    p_h.font.italic = True
    p_h.font.color.rgb = C_PRIMARY_PURPLE

    line = s17.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.3), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    chars_data = [
        ("Celie", "From Silence to Sovereignty", "Begins as a traumatized, mute domestic victim ('Celie, you a tree'). Through Shug's love, Nettie's recovered letters, and economic enterprise, she reclaims bodily autonomy and declares: 'I'm pore, I'm black, I may be ugly... But I'm here!'"),
        ("Shug Avery", "The Autonomous Healer", "Independent, fiercely sexual blues singer who refuses societal and patriarchal norms. Acts as the spiritual teacher who uncovers Albert's trunk, guides Celie away from murder to sewing, and preaches the immanence of God."),
        ("Albert (Mr. _____)", "Patriarch to Humble Companion", "Begins as an abusive, arrogant patriarch who suppresses Nettie's letters. Driven to despair by Celie's curse, he repents, learns to clean, cook, and sew, becoming Celie's respectful friend under the stars.")
    ]

    for idx, (c_name, c_role, c_desc) in enumerate(chars_data):
        c_left = Inches(0.85) + idx * Inches(3.98)
        card = s17.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, Inches(1.6), Inches(3.78), Inches(5.2))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_PRIMARY_PURPLE
        card.line.width = Pt(1.5)

        tb = s17.shapes.add_textbox(c_left + Inches(0.2), Inches(1.8), Inches(3.38), Inches(4.7))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = c_name
        p.font.name = "Georgia"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = C_PRIMARY_PURPLE

        p_r = tf.add_paragraph()
        p_r.text = c_role
        p_r.font.name = "Segoe UI"
        p_r.font.size = Pt(10.5)
        p_r.font.italic = True
        p_r.font.color.rgb = C_ACCENT_BURGUNDY
        p_r.space_before = Pt(2)

        p_d = tf.add_paragraph()
        p_d.text = c_desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(8)
        p_d.line_spacing = 1.3

    # ==========================================================
    # SLIDE 18: V. Analysis – Deep Symbolism (Matches Gawain Slide 30)
    # ==========================================================
    s18 = prs.slides.add_slide(blank_layout)
    set_bg(s18, C_CREAM_BG)

    tb_hdr = s18.shapes.add_textbox(Inches(0.85), Inches(0.6), Inches(11.5), Inches(0.6))
    tf_h = tb_hdr.text_frame
    p_h = tf_h.paragraphs[0]
    p_h.text = "Deep Symbolism: Roofleaf, Folkspants & The Color Purple"
    p_h.font.name = "Georgia"
    p_h.font.size = Pt(24)
    p_h.font.bold = True
    p_h.font.italic = True
    p_h.font.color.rgb = C_PRIMARY_PURPLE

    line = s18.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.3), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    sym_cards = [
        ("The Sacred Roofleaf vs Corrugated Tin", "Natural Commons vs Industrial Violence", [
            ("Sacred Symbiosis", "Roofleaf provides natural, rainproof shelter and communal worship; embodies harmony between human labor and ecology."),
            ("Tin Exploitation", "Replacing roofleaf with blistering corrugated tin represents the cold, extractive imposition of Western corporate capitalism.")
        ]),
        ("The Needle vs The Razor (Folkspants)", "Sublimation of Fury into Sovereignty", [
            ("Refactoring Violence", "Shug takes the open razor from Celie's hands and replaces it with the needle: converting destructive rage into creative labor."),
            ("Deconstructing Gender", "Celie's pants deconstruct rigid gender roles, giving women mobility in the fields and men comfort in domestic spaces.")
        ]),
        ("The Color Purple", "Miraculous Grace & The Divine Demand for Wonder", [
            ("Theology of Admiration", "'It pisses God off if you walk by the color purple in a field somewhere and don't notice it.'"),
            ("Reclaiming Royal Dignity", "Purple represents the unexpected, radiant beauty in creation, marking Celie's resurrection from drab brown rags to regal wholeness.")
        ])
    ]

    for idx, (title_s, sub_s, items_s) in enumerate(sym_cards):
        c_left = Inches(0.85) + idx * Inches(3.98)
        card = s18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, Inches(1.6), Inches(3.78), Inches(5.2))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_PRIMARY_PURPLE
        card.line.width = Pt(1.5)

        tb = s18.shapes.add_textbox(c_left + Inches(0.2), Inches(1.8), Inches(3.38), Inches(4.7))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title_s
        p.font.name = "Georgia"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_PRIMARY_PURPLE

        p_r = tf.add_paragraph()
        p_r.text = sub_s
        p_r.font.name = "Segoe UI"
        p_r.font.size = Pt(9.5)
        p_r.font.italic = True
        p_r.font.color.rgb = C_ACCENT_BURGUNDY
        p_r.space_before = Pt(2)

        for bold_k, text_v in items_s:
            p_item = tf.add_paragraph()
            p_item.text = f"• {bold_k}: {text_v}"
            p_item.font.name = "Segoe UI"
            p_item.font.size = Pt(9.5)
            p_item.font.color.rgb = C_TEXT_DARK
            p_item.space_before = Pt(6)
            p_item.runs[0].font.bold = True

    # ==========================================================
    # SLIDE 19: VI. Literary Rating – Overview (Matches Gawain Slide 31)
    # ==========================================================
    s19 = prs.slides.add_slide(blank_layout)
    set_bg(s19, C_HERO_BG)

    tb_star = s19.shapes.add_textbox(Inches(5.666), Inches(1.0), Inches(2.0), Inches(1.0))
    tf_st = tb_star.text_frame
    p_st = tf_st.paragraphs[0]
    p_st.alignment = PP_ALIGN.CENTER
    p_st.text = "★"
    p_st.font.size = Pt(44)
    p_st.font.color.rgb = C_OFFWHITE

    tb_t = s19.shapes.add_textbox(Inches(2.0), Inches(2.1), Inches(9.333), Inches(1.2))
    tf_t = tb_t.text_frame
    p_t = tf_t.paragraphs[0]
    p_t.alignment = PP_ALIGN.CENTER
    p_t.text = "Literary Rating"
    p_t.font.name = "Georgia"
    p_t.font.size = Pt(44)
    p_t.font.bold = True
    p_t.font.italic = True
    p_t.font.color.rgb = C_OFFWHITE

    tb_body = s19.shapes.add_textbox(Inches(1.5), Inches(3.6), Inches(10.333), Inches(3.2))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True

    p_b1 = tf_b.paragraphs[0]
    p_b1.text = (
        "TO EVALUATE THE COLOR PURPLE, WE USE SEVEN ESTABLISHED LITERARY STANDARDS: "
        "UNIVERSALITY, PERMANENCE, SUGGESTIVENESS, INTELLECTUAL VALUE, SPIRITUAL VALUE, STYLE, AND "
        "ARTISTRY. THESE STANDARDS ARE RECOGNIZED AS CRITERIA FOR EVALUATING AND ANALYZING LITERARY WORKS "
        "(GARCIA ET AL., UST PUBLISHING HOUSE)."
    )
    p_b1.font.name = "Segoe UI"
    p_b1.font.size = Pt(12)
    p_b1.font.color.rgb = C_OFFWHITE
    p_b1.line_spacing = 1.4
    p_b1.alignment = PP_ALIGN.JUSTIFY

    p_b2 = tf_b.add_paragraph()
    p_b2.text = (
        "EACH STANDARD IS CONSIDERED INDIVIDUALLY TO DETERMINE HOW STRONGLY THE LITERARY WORK "
        "DEMONSTRATES THAT PARTICULAR QUALITY. THE RESULTING RATINGS PROVIDE A STRUCTURED ASSESSMENT OF "
        "THE NOVEL BASED ON THESE SEVEN RIGOROUS LITERARY STANDARDS."
    )
    p_b2.font.name = "Segoe UI"
    p_b2.font.size = Pt(12)
    p_b2.font.color.rgb = RGBColor(220, 205, 235)
    p_b2.line_spacing = 1.4
    p_b2.alignment = PP_ALIGN.JUSTIFY
    p_b2.space_before = Pt(16)

    # ==========================================================
    # SLIDE 20: VI. Rating According to the Seven Literary Standards (Matches Gawain Slide 32)
    # ==========================================================
    s20 = prs.slides.add_slide(blank_layout)
    set_bg(s20, C_CREAM_BG)

    tb_star = s20.shapes.add_textbox(Inches(5.666), Inches(0.4), Inches(2.0), Inches(0.6))
    tf_st = tb_star.text_frame
    p_st = tf_st.paragraphs[0]
    p_st.alignment = PP_ALIGN.CENTER
    p_st.text = "★"
    p_st.font.size = Pt(28)
    p_st.font.color.rgb = C_PRIMARY_PURPLE

    tb_sub = s20.shapes.add_textbox(Inches(1.0), Inches(0.95), Inches(11.333), Inches(0.4))
    tf_sub = tb_sub.text_frame
    p_s = tf_sub.paragraphs[0]
    p_s.alignment = PP_ALIGN.CENTER
    p_s.text = "RATING ACCORDING TO THE SEVEN LITERARY STANDARDS"
    p_s.font.name = "Segoe UI"
    p_s.font.size = Pt(12)
    p_s.font.bold = True
    p_s.font.color.rgb = C_PRIMARY_PURPLE

    # Table
    rows = 8
    cols = 3
    table_shape = s20.shapes.add_table(rows, cols, Inches(0.85), Inches(1.45), Inches(11.633), Inches(5.4))
    tbl = table_shape.table
    tbl.columns[0].width = Inches(2.4)
    tbl.columns[1].width = Inches(1.6)
    tbl.columns[2].width = Inches(7.633)

    tbl_headers = ["S T A N D A R D", "R A T I N G", "E V A L U A T I O N"]
    for c_i, h_txt in enumerate(tbl_headers):
        cell = tbl.cell(0, c_i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_DEEP_PURPLE
        p = cell.text_frame.paragraphs[0]
        p.text = h_txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_WHITE
        p.alignment = PP_ALIGN.CENTER if c_i == 1 else PP_ALIGN.LEFT

    eval_data = [
        ("Artistry", "10/10", "Masterful epistolary design; dual-voiced transatlantic counterpoint between Georgia and West Africa."),
        ("Intellectual Value", "10/10", "Unflinching critique of patriarchal domestic violence, religious dogma, racism, and colonial extraction."),
        ("Suggestiveness", "10/10", "Multi-layered symbolism: the sacred roofleaf, quilt patterns, custom pants, and the color purple."),
        ("Spiritual Value", "10/10", "Liberation from patriarchal religious dogma toward immanent, life-affirming Panentheism and self-worth."),
        ("Permanence", "10/10", "Translated into over 25 languages; adapted into films and Tony-winning Broadway plays; permanent classic."),
        ("Universality", "10/10", "Speaks universally to human resilience, the reclamation of voice, sisterhood, and the triumph of the soul."),
        ("Style", "10/10", "Revolutionary elevation of Black folk vernacular (AAVE) into poetic, lyrical, unmediated epistolary literature.")
    ]

    for r_i, (std, rat, eva) in enumerate(eval_data, start=1):
        for c_i, val in enumerate([std, rat, eva]):
            cell = tbl.cell(r_i, c_i)
            cell.fill.solid()
            cell.fill.fore_color.rgb = C_WHITE if r_i % 2 == 1 else RGBColor(246, 243, 238)
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.name = "Segoe UI"
            p.font.size = Pt(10)
            p.font.color.rgb = C_TEXT_DARK
            if c_i == 0:
                p.font.bold = True
                p.font.color.rgb = C_PRIMARY_PURPLE
            elif c_i == 1:
                p.font.bold = True
                p.font.color.rgb = C_ACCENT_BURGUNDY
                p.alignment = PP_ALIGN.CENTER

    # ==========================================================
    # SLIDE 21: VI. Standards of Literary Awards & Prizes (Matches Gawain Slide 33 layout)
    # ==========================================================
    s21 = prs.slides.add_slide(blank_layout)
    set_bg(s21, C_CREAM_BG)

    tb_star = s21.shapes.add_textbox(Inches(5.666), Inches(0.4), Inches(2.0), Inches(0.6))
    tf_st = tb_star.text_frame
    p_st = tf_st.paragraphs[0]
    p_st.alignment = PP_ALIGN.CENTER
    p_st.text = "★"
    p_st.font.size = Pt(28)
    p_st.font.color.rgb = C_PRIMARY_PURPLE

    tb_sub = s21.shapes.add_textbox(Inches(1.0), Inches(0.95), Inches(11.333), Inches(0.4))
    tf_sub = tb_sub.text_frame
    p_s = tf_sub.paragraphs[0]
    p_s.alignment = PP_ALIGN.CENTER
    p_s.text = "LITERARY STANDARDS OF LITERARY AWARDS OR PRIZES"
    p_s.font.name = "Segoe UI"
    p_s.font.size = Pt(12)
    p_s.font.bold = True
    p_s.font.color.rgb = C_PRIMARY_PURPLE

    # 3 Awards Cards
    awards_info = [
        ("The Pulitzer Prize for Fiction", "Won in 1983", "Alice Walker made history as the first African-American woman to win the Pulitzer Prize for Fiction. The Pulitzer board commended the novel for its innovative epistolary technique, profound portrayal of the human spirit under oppression, and unyielding defense of human dignity."),
        ("The National Book Award", "Won in 1983", "Awarded the 1983 National Book Award for Fiction (shared with Alice Munro), confirming unanimous consensus among major American literary critics. The jury celebrated Walker's lyrical command of Black English vernacular and fearless psychological realism."),
        ("Enduring Media Adaptations", "Multi-Generational Canon", "Nominated for 11 Academy Awards in Steven Spielberg's 1985 cinematic masterpiece; won multiple Tony Awards for the 2005 original and 2015 Broadway revival; adapted into a 2023 musical film, verifying its permanent status as a global literary touchstone.")
    ]

    for idx, (a_title, a_sub, a_desc) in enumerate(awards_info):
        c_left = Inches(0.85) + idx * Inches(3.98)
        card = s21.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, Inches(1.5), Inches(3.78), Inches(5.3))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_PRIMARY_PURPLE
        card.line.width = Pt(1.5)

        tb = s21.shapes.add_textbox(c_left + Inches(0.2), Inches(1.7), Inches(3.38), Inches(4.8))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = a_title
        p.font.name = "Georgia"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = C_PRIMARY_PURPLE

        p_r = tf.add_paragraph()
        p_r.text = a_sub
        p_r.font.name = "Segoe UI"
        p_r.font.size = Pt(11)
        p_r.font.italic = True
        p_r.font.color.rgb = C_ACCENT_BURGUNDY
        p_r.space_before = Pt(3)

        p_d = tf.add_paragraph()
        p_d.text = a_desc
        p_d.font.name = "Segoe UI"
        p_d.font.size = Pt(10)
        p_d.font.color.rgb = C_TEXT_DARK
        p_d.space_before = Pt(10)
        p_d.line_spacing = 1.35

    # ==========================================================
    # SLIDE 22: VII. The Color Purple in Relation to Modern Technology (Matches Gawain Slide 34)
    # ==========================================================
    s22 = prs.slides.add_slide(blank_layout)
    set_bg(s22, C_CREAM_BG)

    # Suit Icons Top Center
    tb_suits = s22.shapes.add_textbox(Inches(4.5), Inches(0.35), Inches(4.333), Inches(0.6))
    tf_su = tb_suits.text_frame
    p_su = tf_su.paragraphs[0]
    p_su.alignment = PP_ALIGN.CENTER
    p_su.text = "♠  ♥  ♣  ♦"
    p_su.font.size = Pt(24)
    p_su.font.color.rgb = C_ACCENT_BURGUNDY

    # Title
    tb_it_t = s22.shapes.add_textbox(Inches(0.85), Inches(0.95), Inches(11.633), Inches(0.45))
    tf_it = tb_it_t.text_frame
    p_it = tf_it.paragraphs[0]
    p_it.alignment = PP_ALIGN.CENTER
    p_it.text = "THE COLOR PURPLE IN RELATION TO MODERN TECHNOLOGY (1/2)"
    p_it.font.name = "Segoe UI"
    p_it.font.size = Pt(12)
    p_it.font.bold = True
    p_it.font.color.rgb = C_PRIMARY_PURPLE

    # Table
    table_shape = s22.shapes.add_table(4, 2, Inches(0.85), Inches(1.5), Inches(11.633), Inches(5.4))
    tbl = table_shape.table
    tbl.columns[0].width = Inches(3.2)
    tbl.columns[1].width = Inches(8.433)

    headers_it = ["C O N C E P T\nM O D E R N   T E C H N O L O G Y", "P A R A L L E L\nT H E   C O L O R   P U R P L E"]
    for c_i, h_txt in enumerate(headers_it):
        cell = tbl.cell(0, c_i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_DEEP_PURPLE
        p = cell.text_frame.paragraphs[0]
        p.text = h_txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

    it_rows_1 = [
        ("CIA Triad & Man-in-the-Middle (MitM) Interception",
         "NIST identifies Confidentiality, Integrity, and Availability as the core CIA triad. Albert executes a classic MitM attack: intercepting incoming letters from Nettie and dropping them into a locked offline cache (trunk). By withholding availability, he simulates an endpoint failure, leaving both sisters in isolation."),
        ("Asynchronous Messaging & Missing ACKs",
         "Celie sends messages to 'God' and Nettie without confirmation of receipt (ACK), functioning as high-latency store-and-forward transmission. The recovery of the letters mirrors flushing an unacknowledged message queue to restore end-to-end data synchronization."),
        ("Data Provenance & Metadata Rectification",
         "Celie's identity is distorted by corrupted provenance (believing Alphonso is her biological father). Samuel's revelation ('Pa is not our pa!') cleanses corrupted system metadata, restoring authentic lineage, removing biological shame, and reclaiming property rights.")
    ]

    for r_i, (concept, parallel) in enumerate(it_rows_1, start=1):
        cell_c = tbl.cell(r_i, 0)
        cell_c.fill.solid()
        cell_c.fill.fore_color.rgb = C_WHITE if r_i % 2 == 1 else RGBColor(246, 243, 238)
        p_c = cell_c.text_frame.paragraphs[0]
        p_c.text = concept
        p_c.font.name = "Segoe UI"
        p_c.font.size = Pt(10)
        p_c.font.bold = True
        p_c.font.color.rgb = C_PRIMARY_PURPLE

        cell_p = tbl.cell(r_i, 1)
        cell_p.fill.solid()
        cell_p.fill.fore_color.rgb = C_WHITE if r_i % 2 == 1 else RGBColor(246, 243, 238)
        p_p = cell_p.text_frame.paragraphs[0]
        p_p.text = parallel
        p_p.font.name = "Segoe UI"
        p_p.font.size = Pt(9.5)
        p_p.font.color.rgb = C_TEXT_DARK
        p_p.line_spacing = 1.3

    # ==========================================================
    # SLIDE 23: VII. The Color Purple in Relation to Modern Technology (Matches Gawain Slide 35)
    # ==========================================================
    s23 = prs.slides.add_slide(blank_layout)
    set_bg(s23, C_CREAM_BG)

    tb_suits = s23.shapes.add_textbox(Inches(4.5), Inches(0.35), Inches(4.333), Inches(0.6))
    tf_su = tb_suits.text_frame
    p_su = tf_su.paragraphs[0]
    p_su.alignment = PP_ALIGN.CENTER
    p_su.text = "♠  ♥  ♣  ♦"
    p_su.font.size = Pt(24)
    p_su.font.color.rgb = C_ACCENT_BURGUNDY

    tb_it_t = s23.shapes.add_textbox(Inches(0.85), Inches(0.95), Inches(11.633), Inches(0.45))
    tf_it = tb_it_t.text_frame
    p_it = tf_it.paragraphs[0]
    p_it.alignment = PP_ALIGN.CENTER
    p_it.text = "THE COLOR PURPLE IN RELATION TO MODERN TECHNOLOGY (2/2)"
    p_it.font.name = "Segoe UI"
    p_it.font.size = Pt(12)
    p_it.font.bold = True
    p_it.font.color.rgb = C_PRIMARY_PURPLE

    table_shape = s23.shapes.add_table(4, 2, Inches(0.85), Inches(1.5), Inches(11.633), Inches(5.4))
    tbl = table_shape.table
    tbl.columns[0].width = Inches(3.2)
    tbl.columns[1].width = Inches(8.433)

    for c_i, h_txt in enumerate(headers_it):
        cell = tbl.cell(0, c_i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = C_DEEP_PURPLE
        p = cell.text_frame.paragraphs[0]
        p.text = h_txt
        p.font.name = "Segoe UI"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

    it_rows_2 = [
        ("Protocol Switching & Endpoint DNS Rerouting",
         "When Celie changes her letter recipient from 'Dear God' to 'Dear Nettie' in Letter 69, she performs an architectural DNS reroute. She shifts from broadcasting requests to a silent, unresponsive legacy host to establishing an authenticated peer-to-peer encrypted channel with her sister."),
        ("Open-Source Commons vs Proprietary Lock-In",
         "The Olinka roofleaf represents sustainable, shared open-source commons. The English rubber company's bulldozers represent predatory vendor lock-in—destroying open community infrastructure and charging recurring licenses/rent on basic survival (land and water taxes)."),
        ("Intersectional AI & Algorithmic Bias Auditing",
         "Womanism requires evaluating intersecting variables (race, gender, class). In computing, Buolamwini & Gebru's 'Gender Shades' study proved facial-analysis models fail when trained on monolithic data. Evaluating systems along intersectional axes prevents systemic bias and protects marginalized users.")
    ]

    for r_i, (concept, parallel) in enumerate(it_rows_2, start=1):
        cell_c = tbl.cell(r_i, 0)
        cell_c.fill.solid()
        cell_c.fill.fore_color.rgb = C_WHITE if r_i % 2 == 1 else RGBColor(246, 243, 238)
        p_c = cell_c.text_frame.paragraphs[0]
        p_c.text = concept
        p_c.font.name = "Segoe UI"
        p_c.font.size = Pt(10)
        p_c.font.bold = True
        p_c.font.color.rgb = C_PRIMARY_PURPLE

        cell_p = tbl.cell(r_i, 1)
        cell_p.fill.solid()
        cell_p.fill.fore_color.rgb = C_WHITE if r_i % 2 == 1 else RGBColor(246, 243, 238)
        p_p = cell_p.text_frame.paragraphs[0]
        p_p.text = parallel
        p_p.font.name = "Segoe UI"
        p_p.font.size = Pt(9.5)
        p_p.font.color.rgb = C_TEXT_DARK
        p_p.line_spacing = 1.3

    # ==========================================================
    # SLIDE 24: IT Discussion Question (Matches Gawain Slide 36/37)
    # ==========================================================
    s24 = prs.slides.add_slide(blank_layout)
    set_bg(s24, C_CREAM_BG)

    tb_q = s24.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(0.6))
    tf_q = tb_q.text_frame
    p_q = tf_q.paragraphs[0]
    p_q.text = "Question"
    p_q.font.name = "Georgia"
    p_q.font.size = Pt(36)
    p_q.font.bold = True
    p_q.font.italic = True
    p_q.font.color.rgb = C_PRIMARY_PURPLE

    tb_q_sub = s24.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(0.6))
    tf_qs = tb_q_sub.text_frame
    p_qs = tf_qs.paragraphs[0]
    p_qs.text = "HOW DOES THE COLOR PURPLE'S EPISTOLARY ARCHITECTURE INFORM MODERN INFORMATION SECURITY & PROTOCOL DESIGN?"
    p_qs.font.name = "Segoe UI"
    p_qs.font.size = Pt(12)
    p_qs.font.bold = True
    p_qs.font.color.rgb = C_PRIMARY_PURPLE

    line = s24.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.0), Inches(2.2), Inches(11.333), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    tb_ans = s24.shapes.add_textbox(Inches(1.0), Inches(2.5), Inches(11.333), Inches(4.3))
    tf_ans = tb_ans.text_frame
    tf_ans.word_wrap = True

    pts_ans = [
        ("The Vulnerability of Centralized Gatekeepers", "Celie's prolonged abuse was enabled because Albert held exclusive monopolistic control over physical packet ingress and egress. In IT, single-gateway architectures without redundant routing are inherently vulnerable to censorship and data loss."),
        ("Cryptographic Secrecy as Survival", "Celie's letters to God functioned as an encrypted journal—accessible only to the author and the trusted recipient. This demonstrates why end-to-end encryption is not merely a technical luxury, but a vital human right for marginalized populations."),
        ("Refactoring Deadly Failures", "Celie refactoring homicidal rage into commercial pants production illustrates that system deadlocks and catastrophic race conditions are best resolved by redirecting energy into constructive, scalable pipelines rather than executing destructive halts.")
    ]

    for idx, (head_a, body_a) in enumerate(pts_ans):
        p = tf_ans.add_paragraph() if idx > 0 else tf_ans.paragraphs[0]
        p.text = f"{idx+1}. {head_a}"
        p.font.name = "Georgia"
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = C_PRIMARY_PURPLE
        p.space_before = Pt(12) if idx > 0 else Pt(0)

        p_b = tf_ans.add_paragraph()
        p_b.text = body_a
        p_b.font.name = "Segoe UI"
        p_b.font.size = Pt(11)
        p_b.font.color.rgb = C_TEXT_DARK
        p_b.space_before = Pt(3)

    # ==========================================================
    # SLIDE 25: Addition – Symbolism, Colors & Depictions in Modern Media (Matches Gawain Slide 40-44)
    # ==========================================================
    s25 = prs.slides.add_slide(blank_layout)
    set_bg(s25, C_CREAM_BG)

    tb_hdr = s25.shapes.add_textbox(Inches(0.85), Inches(0.6), Inches(11.5), Inches(0.6))
    tf_h = tb_hdr.text_frame
    p_h = tf_h.paragraphs[0]
    p_h.text = "Addition: Symbolism & Depictions in Modern Media"
    p_h.font.name = "Georgia"
    p_h.font.size = Pt(24)
    p_h.font.bold = True
    p_h.font.italic = True
    p_h.font.color.rgb = C_PRIMARY_PURPLE

    line = s25.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(1.3), Inches(11.6), Inches(0.02))
    line.fill.solid()
    line.fill.fore_color.rgb = C_LINE_PURPLE
    line.line.fill.background()

    # 3 Cards: Colors, Objects, Media
    cards_extra = [
        ("A. Symbolic Colors", "Chromatic Meaning in the Novel", [
            ("Purple", "Ambivalent and divine; signifies God's gift of beauty in nature, royal dignity, and spiritual resurrection."),
            ("Red", "Associated with passion, sexual vitality, and defiance (Shug's red dress, blood, courage)."),
            ("Blue / Yellow", "Blue pants represent peace and creative craft; yellow floor represents morning sunlight, optimism, and warmth.")
        ]),
        ("B. Sacred Objects", "Artifacts of Struggle & Agency", [
            ("The Needle vs Razor", "The razor represents violent destruction; the needle represents constructive healing and economic agency."),
            ("Albert's Trunk", "Centralized, locked offline cache concealing suppressed memory and withheld family communication."),
            ("The Quilt (Sister's Choice)", "Pieced from scraps; symbolizes diverse women stitching together their lives in communal sisterhood.")
        ]),
        ("C. Depictions in Media", "Cinematic & Broadway Adaptations", [
            ("1985 Spielberg Film", "11 Academy Award nominations; introduced Whoopi Goldberg (Celie) and Oprah Winfrey (Sofia)."),
            ("2005/2015 Broadway Musical", "Produced by Oprah Winfrey & Quincy Jones; won Tony Award for Best Revival of a Musical (Cynthia Erivo)."),
            ("2023 Musical Feature Film", "Directed by Blitz Bazawule, reaffirming the timeless vitality of Walker's message.")
        ])
    ]

    for idx, (title_e, sub_e, items_e) in enumerate(cards_extra):
        c_left = Inches(0.85) + idx * Inches(3.98)
        card = s25.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, c_left, Inches(1.5), Inches(3.78), Inches(5.3))
        card.fill.solid()
        card.fill.fore_color.rgb = C_WHITE
        card.line.color.rgb = C_PRIMARY_PURPLE
        card.line.width = Pt(1.5)

        tb = s25.shapes.add_textbox(c_left + Inches(0.2), Inches(1.7), Inches(3.38), Inches(4.8))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title_e
        p.font.name = "Georgia"
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = C_PRIMARY_PURPLE

        p_r = tf.add_paragraph()
        p_r.text = sub_e
        p_r.font.name = "Segoe UI"
        p_r.font.size = Pt(10)
        p_r.font.italic = True
        p_r.font.color.rgb = C_ACCENT_BURGUNDY
        p_r.space_before = Pt(2)

        for bold_k, text_v in items_e:
            p_item = tf.add_paragraph()
            p_item.text = f"• {bold_k}: {text_v}"
            p_item.font.name = "Segoe UI"
            p_item.font.size = Pt(9.5)
            p_item.font.color.rgb = C_TEXT_DARK
            p_item.space_before = Pt(6)
            p_item.runs[0].font.bold = True

    # ==========================================================
    # SLIDE 26: VII. References & Thank You! (Matches Gawain Slide 45)
    # ==========================================================
    s26 = prs.slides.add_slide(blank_layout)
    set_bg(s26, C_HERO_BG)

    tb_ty = s26.shapes.add_textbox(Inches(2.0), Inches(0.8), Inches(9.333), Inches(1.2))
    tf_ty = tb_ty.text_frame
    p_ty1 = tf_ty.paragraphs[0]
    p_ty1.alignment = PP_ALIGN.CENTER
    p_ty1.text = "Thank You!"
    p_ty1.font.name = "Georgia"
    p_ty1.font.size = Pt(44)
    p_ty1.font.bold = True
    p_ty1.font.italic = True
    p_ty1.font.color.rgb = C_OFFWHITE

    p_ty2 = tf_ty.add_paragraph()
    p_ty2.alignment = PP_ALIGN.CENTER
    p_ty2.text = "R E F E R E N C E S"
    p_ty2.font.name = "Segoe UI"
    p_ty2.font.size = Pt(13)
    p_ty2.font.bold = True
    p_ty2.font.color.rgb = C_GOLD
    p_ty2.space_before = Pt(4)

    tb_refs = s26.shapes.add_textbox(Inches(1.2), Inches(2.2), Inches(10.9), Inches(4.8))
    tf_rf = tb_refs.text_frame
    tf_rf.word_wrap = True

    citations = [
        "Buolamwini, J., & Gebru, T. (2018). Gender shades: Intersectional accuracy disparities in commercial gender classification. Proceedings of Machine Learning Research, 81, 77–91.",
        "Encyclopaedia Britannica. (n.d.). The Color Purple. Retrieved October 1, 2026, from https://www.britannica.com/topic/The-Color-Purple",
        "Encyclopaedia Britannica. (n.d.). Womanism. Retrieved October 1, 2026, from https://www.britannica.com/topic/womanism",
        "Garcia, Carolina U., Piedad G. Rosales, and Corinta G. Barranco. A Study of Literary Types and Forms. UST Publishing House, 2000.",
        "National Institute of Standards and Technology. (n.d.). CIA Triad. NIST Computer Security Resource Center Glossary. Retrieved October 1, 2026, from https://csrc.nist.gov/glossary/term/CIA",
        "SparkNotes Editors. (n.d.). The Color Purple: Letters 61–69 Summary & Analysis; Plot Overview; Symbols. SparkNotes LLC. Retrieved October 1, 2026, from https://www.sparknotes.com/lit/purple/section6/",
        "Walker, Alice. (1982). The Color Purple. Harcourt Brace Jovanovich. (Electronic Edition: Open Road Integrated Media, New York, 2011).",
        "Walker, Alice. (1983). In Search of Our Mothers' Gardens: Womanist Prose. San Diego: Harcourt Brace Jovanovich.",
        "Walker, Alice. (1992). 'Preface.' The Color Purple (Tenth Anniversary Edition). New York: Harcourt Brace & Company."
    ]

    for idx, cite in enumerate(citations):
        p = tf_rf.add_paragraph() if idx > 0 else tf_rf.paragraphs[0]
        p.text = "• " + cite
        p.font.name = "Segoe UI"
        p.font.size = Pt(9.5)
        p.font.color.rgb = C_OFFWHITE
        p.space_after = Pt(4)
        p.line_spacing = 1.25

    prs.save(output_pptx_path)
    print(f"Successfully generated 26-slide Gawain-formatted presentation at: {output_pptx_path}")

if __name__ == "__main__":
    out_dir = r"c:\Users\Leinardt\OneDrive\Documents\ARALert\presentation"
    os.makedirs(out_dir, exist_ok=True)
    out_pptx = os.path.join(out_dir, "The_Color_Purple_Letters_61-69_IT_Report.pptx")
    create_deck(out_pptx)
