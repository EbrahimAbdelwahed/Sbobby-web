# MCQ Normalization Audit

## Sources

- Seed: /Users/ebrahimabdelwahed/Desktop/Med/Lezioni/Audio_to_Sbobina/sbobby-web/data/seed.json
- Parsed embedded options: /Users/ebrahimabdelwahed/Desktop/Med/Lezioni/Audio_to_Sbobina/sbobby-web/data/pipeline/exam_questions_embedded_options_parsed.jsonl
- Windowjudge15 answers: /Users/ebrahimabdelwahed/Desktop/Med/Lezioni/Audio_to_Sbobina/sbobby-web/data/pipeline/rag_answers_684_top12_partial_plus_grep_all_hard_residual60_pageindex_grep_parsedopts4_windowjudge15_reconciled.jsonl

## Counts

- Total questions: 684
- Seed questions already carrying explicit options: 207
- Questions selectable as MCQ after embedded parsing: 563
-  of which explicit multiple_choice: 207
-  of which open but parsed into options: 356
- Answers deterministically mappable to an option label: 530
-  explicit multiple_choice mapped: 182
-  open parsed mapped: 348
- Selectable questions still unresolved by label mapping: 33
- Metadata-contaminated questions: 1

## Deterministic Rules

- Keep only rows with options already present or extracted from embedded option lines.
- Map answers only when the answer string yields a standalone label A-F and the label matches an existing option label after normalization.
- Do not infer answers from prose, explanation text, or source evidence.
- Flag metadata contamination only when the row contains explicit speaker / editor / timestamp / separator artifacts in raw text or question text.

## Contamination

- q_299a9cabeb6e: Segnare l’affermazione FALSA | Segnare l’affermazione FALSA: a) La mielinizzazione nel SNP è deputata alle cellule di Schwann b) Nel SNC un singolo oligodendrocita avvolge sempre numerosi as...

## Unresolved Selectable Questions

- q_5ec4008df4bb (explicit-mcq): Nella scapola, la fossa infraspinata: toraciche | answer: Non disponibile
- q_f0129e479a29 (explicit-mcq): Indicare l’aﬀermazione corretta: | answer: undetermined
- q_e131c875a584 (explicit-mcq): Quale fra questi non fa parte dei muscoli adduttori dell’arto inferiore? | answer: Da completare in revisione umana prima della pubblicazione.
- q_1454736120cd (explicit-mcq): Dove si trova il corpo adiposo di Hoﬀa? | answer: Non determinabile dalle fonti fornite
- q_b4a57838a946 (explicit-mcq): Quale funzione ha il capo lungo del muscolo bicipite brachiale a livello dell’articolazione della spalla?
- q_c6ec4855774c (explicit-mcq): “Strato di cellule endoteliali fusate, disposte secondo il decorso vasale, che poggiano su una membrana basale”, stiamo... | answer: Intima
- q_01ded36224dd (explicit-mcq): Quale dei seguenti muscoli non fa parte della cuﬃa dei rotatori? | answer: Da completare in revisione umana prima della pubblicazione.
- q_2677ad4f2167 (explicit-mcq): I linfonodi a livello diaframmatico: | answer: N/A
- q_a80a6face7e8 (explicit-mcq): Indicare quale delle seguenti aﬀermazioni sulla colonna vertebrale è falsa: dischi I.V. vertebrali attraverso i pori po... | answer: Da completare in revisione umana prima della pubblicazione.
- q_d0df7b963ed5 (explicit-mcq): Nel tratto cervicale della colonna vertebrale (indicare l’aﬀermazione errata): contigue
- q_9dc644eb4abb (explicit-mcq): Quale aﬀermazione sull’articolazione della spalla è falsa: livello dell’intervallo dei rotatori | answer: Impossibile determinare la risposta corretta con le fonti fornite
- q_34807edf67e3 (explicit-mcq): A livello arterioso: | answer: Nessuna delle opzioni è corretta
- q_b4ead924f8b6 (explicit-mcq): Quale tra i seguenti non fa parte dei muscoli dell’eminenza tenar? | answer: Da completare in revisione umana prima della pubblicazione.
- q_ad7664ae4259 (explicit-mcq): Quali sono origine e inserzione del muscolo soleo?
- q_c16f6e60155e (explicit-mcq): Quali legamenti sono coinvolti nella stabilizzazione dell’articolazione della spalla? | answer: Da completare in revisione umana prima della pubblicazione.
- q_3e792c060add (explicit-mcq): La membrana atlanto-occipitale è la prosecuzione di quale legamento rachideo? | answer: Da completare in revisione umana prima della pubblicazione.
- q_85fec45f912d (explicit-mcq): Segnare l’aﬀermazione FALSA riguardo alla muscolatura dell’avambraccio: rotondo, flessore radiale del carpo, flessore u... | answer: N/A
- q_666aed3876b9 (explicit-mcq): Segnare l’aﬀermazione FALSA riguardo all’innervazione della mano: del polso | answer: Risposta non determinabile con le fonti fornite
- q_cd6930f1f363 (explicit-mcq): Parlando del tunnel carpale: dei muscoli flessori
- q_9d434690655f (explicit-mcq): Segnare l’aﬀermazione FALSA riguardo alla vascolarizzazione dell’arto superiore: ricorrenti del polso ha importante ris... | answer: Insufficient information to identify false statement
