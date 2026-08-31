# 🏆 DEVPOST SUBMISSION KIT — TRAZO
### **Google Cloud "All Things Agentic" Global Hackathon**

---

## 📌 1. BASIC INFORMATION & METADATA

* **Project Title:**  
  `TRAZO — Autonomous Agentic Learning Engine`

* **Elevator Pitch / Tagline (Under 200 chars):**  
  `Transforming passive online courses into an interactive, verified-action quest map guided by an autonomous AI companion on Google Vertex AI (Gemini 3.7 Flash).`

* **Category / Track to Select:**  
  `The Collaborative Partner` *(or Taskmaster)*  
  *(TRAZO is the textbook definition of a Collaborative Partner: an AI Companion that actively pairs with students, evaluates deliverables, and rescues them from learning friction).*

* **Live Demo URL:**  
  `https://trazo-759796956692.us-central1.run.app`

* **Testing Instructions for Judges:**  
  ```text
  No credentials required! Simply open the link, enter your name in the 8-second quick setup, and explore the interactive mission map.
  Try submitting Mission 1 (N01) to observe instant Vertex AI verification (PASS) and watch the dynamic corridor bifurcation unlock N02 and N03 in real time.
  ```

* **Google AI Models & SDKs Used:**  
  * `Google Gemini 3.7 Flash` (via Vertex AI)
  * `Google GenAI SDK` (`@google/genai`)
  * `Google Cloud Run` (Serverless Container in us-central1)
  * `Google Cloud Firestore` (Authoritative Document Database)
  * `Google Cloud Build` (Automated Container CI/CD)

* **Date Project Started:**  
  `August 2026` *(within the hackathon submission window)*

---

## 📝 2. DEVPOST WRITTEN FORM FIELDS (Copy & Paste Ready)

### 💡 Inspiration (The Problem)
```markdown
Online education is suffering from a documented 96% drop-off rate (Harvard & MIT research, *Science*). Traditional e-learning forces students into passive video consumption. When learners hit a wall, they either abandon the course or turn to generic chatbot wrappers that flatter them and hallucinate completion.

We asked: *What if an educational course wasn't a video playlist, but an autonomous, living quest map overseen by an intelligent companion that strictly verifies real-world deliverables, adapts routes in real time, and proactively rescues students when they struggle?*

That is why we built **TRAZO**.
```

### ⚡ What it Does (Core Features & Agentic Capabilities)
```markdown
TRAZO is an autonomous agentic progression engine:

1. **Interactive 2.5D Quest Map (DAG):** Instead of a static syllabus, curriculum is structured as a Directed Acyclic Graph of executable deliverables.
2. **Autonomous Evidence Evaluation:** Powered by **Google Gemini 3.7 Flash on Vertex AI**, Trazz (the companion) inspects qualitative evidence against strict creator rubrics and outputs structured JSON verdicts.
3. **Consequential Progression & Downstream Artifact Chaining:** A `PASS` verdict permanently locks in a canonical deliverable (e.g., a business premise) that is automatically injected as a trusted constraint into downstream mission prompts.
4. **Non-Sycophantic Feedback (REWORK):** Trazz never gives "pity passes." If a deliverable is inconsistent or incomplete, the student receives clear, rubric-grounded feedback without advancing illegally.
5. **Autonomous Proactive Friction Rescue:** If a learner struggles with 2 consecutive `REWORK` verdicts on the same mission, TRAZO's background autonomy engine intervenes without prompting, generating tailored adaptive guidance to unblock them.
6. **Creator Calibration Cockpit:** Course creators calibrate Gemini against synthetic and real-world edge cases with cryptographic SHA-256 rubric versioning.
```

### 🛠️ How We Built It (Architecture & Stack)
```markdown
TRAZO was engineered from the ground up on Google Cloud:

* **Google Vertex AI (Gemini 3.7 Flash):** Handles multimodal rubric evaluation and proactive hint synthesis with strict reasoning budgets (`thinkingBudget: 0`) delivering sub-3-second responses.
* **Deterministic State Machine vs. Probabilistic LLMs:** We maintain a strict boundary: Gemini interprets nuance, but our deterministic Node.js backend authoritatively owns state transitions. A non-PASS result can never illegally mutate progression.
* **Google Cloud Firestore:** Serves as the authoritative persistence layer for user states, rubric calibrations, and immutable progress artifacts.
* **Google Cloud Run:** Fully containerized serverless deployment in `us-central1` with automated scaling and zero cold-start friction.
* **Frontend:** React 19, TypeScript, and a custom APCA-accessible 60-30-10 design system with smooth SVG corridor animations.
* **Testing Suite:** 222 automated unit and integration tests passing in CI/CD.
```

### 🧗 Challenges We Overcame
```markdown
1. **Enforcing Deterministic Integrity over Probabilistic Outputs:** LLMs can occasionally hallucinate progress. We designed a fail-closed schema validator that discards malformed model outputs and requires explicit criterion satisfaction before advancing state.
2. **Sub-3s Real-Time Latency:** Initial evaluations with extended thinking budgets took 10+ seconds. By tuning the Gemini 3.7 Flash configuration and bounding context injection, we brought total round-trip evaluation latency down to ~2 seconds.
3. **Google Translate Reconciler Resilience:** Handling browser translation extensions without crashing React's DOM tree required custom Node reconciliation interceptors.
```

### 🏅 Accomplishments We're Proud Of
```markdown
* Built an end-to-end autonomous agentic system where AI is not just a passive sidebar chat, but the core engine determining educational progression.
* Passing **222 automated test suites** validating domain policy, anti-sycophancy invariants, and state security.
* Deployed a production-ready, highly responsive service on **Google Cloud Run** connected to **Vertex AI** and **Firestore**.
```

### 📚 What We Learned
```markdown
* How to combine Google GenAI SDK with structured JSON schemas to achieve reliable, deterministic evaluations from multimodal models.
* How to design autonomous triggers (e.g., 2x REWORK friction detection) that feel genuinely helpful rather than intrusive.
```

### 🚀 What's Next for TRAZO
```markdown
* **Gemini Live Multimodal Voice Coaching:** Enabling real-time spoken coaching sessions with Trazz for pitch rehearsal and interview preparation.
* **Multi-Course Creator Marketplace:** Allowing educators worldwide to calibrate and publish their own agentic quest maps in minutes.
```

---

## 🏷️ 3. "BUILT WITH" TAGS (Select all that apply on Devpost)

`google-cloud`, `vertex-ai`, `gemini-3.7-flash`, `google-genai-sdk`, `cloud-run`, `cloud-firestore`, `cloud-build`, `react`, `typescript`, `node.js`, `playwright`, `docker`

---

## 🔒 4. REPOSITORY PERMISSIONS CHECK
If your GitHub repository is private, remember to invite:
* `testing@devpost.com`
* `cloudhackathons@google.com`