# Wren Birth Support: Doula Website Prompt

## 1. Goal
Build a gentle, reassuring website for **Wren Birth Support**, the practice of Hannah Wren, a birth and postnatal doula in Bristol. Soft warm white, blush and sage, rounded shapes, a friendly serif with a clear sans. It should feel calm and personal, like a conversation over tea, and make it easy to book a free first call.

## 2. Tech Stack
```
React + Vite + TypeScript + Tailwind CSS + Framer Motion (motion/react) + lucide-react
```
Single page. No component libraries, no booking system. The contact form only shows a thank you message.

## 3. Design system
```css
:root {
  --paper: #FBF6F2;
  --ink: #2B2622;
  --accent: #5B755B;        /* sage */
  --on-accent: #FFFFFF;
  --surface: #F3E7DF;       /* blush */
  --muted: #6A5F58;
  --line: rgba(43,38,34,0.12);
  --radius-card: 24px;
}
```
Rounded is the theme here: cards 24px, images 24px, inputs 14px. Every text colour must reach at least 4.5 to 1 against its background. No text under 14px.

## 4. Typography
```html
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Nunito+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
```
- **Headings:** Lora 500, clamp(36px, 4.6vw, 64px), line-height 1.12. One italic phrase per heading is welcome.
- **Body:** Nunito Sans 400, 18px, line-height 1.7
- **Labels:** Nunito Sans 700, 14px, letter-spacing 0.04em, sage colour, sentence case (not uppercase)

## 5. Buttons
Soft and friendly:
- **Primary:** fully rounded, sage fill, white Nunito Sans 700 text, padding 16px 30px. Hover: slightly darker sage and a 2px lift.
- **Secondary:** fully rounded, transparent with a 1.5px ink border at 30% opacity, ink text. Hover: blush fill.
- A small heart or leaf icon is not allowed in buttons. Text only.

## 6. Sections

1. **Navbar:** paper, 76px, not sticky. Wordmark `Wren` in Lora with a tiny sage dot after it, links right, secondary button `Book a free call`.
2. **Hero:** centred. A round portrait photo at 220px with a thin sage ring, then the label, the heading, one paragraph and both buttons side by side. Generous space above and below. *Portrait: a warm smiling woman in her thirties with curly hair, wearing a soft knit cardigan, natural light, sitting in a cosy living room.*
3. **What a doula does:** blush surface, rounded 32px panel inset 24px from the page edges. Two columns: a short heading on the left, three paragraphs on the right explaining the role in plain words.
4. **Support packages:** paper. Three cards with 24px radius and a soft blush background: name, price, a short description and a list of four included items with small sage check marks. The middle card has a sage border 2px and a small label `Most chosen`.
5. **How it works:** a vertical timeline of four steps along a thin sage line with round markers: first call, getting to know you, the birth, after the birth. Each with a short paragraph.
6. **Kind words:** blush. Three testimonials in rounded cards with the parent's first name and the month their baby was born. Quotes in italic Lora.
7. **Questions:** paper. Five questions in rounded accordion rows with a soft plus icon.
8. **Book a free call:** sage panel with 32px radius and white text. A heading, a sentence, and a simple form on paper coloured inputs inside the panel: name, email, due date, a message, and the submit button styled white with sage text. After submit, show `Thank you. I will reply within two days.`
9. **Footer:** paper. Wordmark, area covered, email, Instagram, and a line about qualifications. Small and quiet.

## 7. Motion
Slow and soft. Sections fade in from 20px below with 0.7s duration and an ease out curve. The timeline line draws downward as it enters view. Cards lift 3px on hover. Respect `prefers-reduced-motion`.

## 8. Responsive
- **Mobile under 768px:** portrait 160px. Buttons stack full width. Package cards stack, `Most chosen` first. Timeline stays vertical with smaller markers. Form fields full width.
- **Desktop:** max-width 1120px, section padding 110px.

## 9. Full copy

**Name:** Wren Birth Support
**Nav:** About, Packages, How It Works, Questions. Button: `Book a free call`

**Hero**
- Label: `Birth and postnatal doula in Bristol`
- Heading: `Calm, steady support from your first call to your first weeks at home.` (set "first weeks at home" in italic)
- Text: `I am Hannah. I help families feel informed, listened to and looked after, whether you are planning a home birth, a hospital birth or a caesarean.`
- Buttons: `Book a free call`, `See packages`

**What a doula does**
- Heading: `Not medical. Just there, for you.`
- `A doula is a trained birth companion. I do not replace your midwife or doctor. I am the familiar person who knows your wishes, keeps the room calm and reminds you to drink water.`
- `Before the birth we talk through your options, your fears and your plan. During labour I stay with you for as long as you need me, at home or in hospital.`
- `Afterwards I visit to help with feeding, rest and the many small questions nobody warns you about.`

**Packages**
- `Birth support` £950. `Two antenatal visits, on call from 38 weeks, continuous support in labour, one postnatal visit.` Included: `Two home visits before the birth`, `On call from 38 to 42 weeks`, `With you for the whole labour`, `One visit in the first week`
- `Birth and beyond` £1,350, label `Most chosen`. `Everything in birth support plus six hours of postnatal help in your first month.` Included: `Two home visits before the birth`, `On call from 38 to 42 weeks`, `With you for the whole labour`, `Six hours of help at home after`
- `Postnatal support` £28 an hour. `Gentle practical help at home in the first weeks.` Included: `Feeding support`, `Time for you to sleep or shower`, `Light meals and tidying`, `Someone to talk it through with`

**How it works**
1. `A free first call.` `Twenty minutes to see if we get on. No pressure, no sales pitch.`
2. `Getting to know you.` `Two visits at home to talk about your wishes, your partner's role and what helps you feel safe.`
3. `The birth.` `From 38 weeks I am on call day and night. When you need me, I come and I stay.`
4. `After the birth.` `I visit in the first week and we talk through how it went, at your pace.`

**Kind words**
- `Hannah made the hospital feel like our space. I have never felt so looked after.` Priya, baby born in March
- `My partner said he could not have done it without her, and I believe him.` Laura, baby born in July
- `She answered a three in the morning text about nappies with complete kindness.` Amira, baby born in January

**Questions**
1. `When should I book?` `Most families book in the second trimester, but I am happy to talk at any stage.`
2. `Do you attend hospital births?` `Yes. I support births at Southmead, St Michael's and at home across Bristol.`
3. `Can my partner still be involved?` `Of course. Part of my job is helping your partner feel useful and confident.`
4. `What if you are ill when I go into labour?` `I work with a trusted backup doula you will meet before the birth.`
5. `Can I pay in instalments?` `Yes. The fee can be split into three payments before your due date.`

**Book a free call**
- Heading: `Let's have a cup of tea and a chat.`
- Text: `Tell me a little about you and when your baby is due. I reply to every message within two days.`
- Fields: `Your name`, `Email`, `Due date`, `Anything you would like me to know`
- Button: `Send message`

**Footer**
`Wren Birth Support` · `Covering Bristol, Bath and North Somerset` · `hello@wrenbirth.co.uk` · `Instagram` · `Trained with Doula UK. DBS checked and insured.`

## 10. Never
Stock baby clichés like storks, pastel gradients, glow, glassmorphism, emoji, icon grids, medical red, square sharp buttons, dashes of any kind in the copy, lorem ipsum.

## 11. Dependencies
```json
{ "motion": "^12.0.0", "lucide-react": "^0.460.0", "clsx": "^2.1.0" }
```
