const STORAGE_KEY = "classroom_portal_v1";
const TEACHER_CREDENTIALS = { username: "teacher", password: "admin123" };

const state = {
  session: null,
  data: {
    students: {}
  }
};

const els = {
  teacherModeBtn: document.getElementById("teacher-mode-btn"),
  studentModeBtn: document.getElementById("student-mode-btn"),
  teacherLoginForm: document.getElementById("teacher-login-form"),
  studentLoginForm: document.getElementById("student-login-form"),
  teacherDashboard: document.getElementById("teacher-dashboard"),
  studentDashboard: document.getElementById("student-dashboard"),
  loginSection: document.getElementById("login-section"),
  teacherLogout: document.getElementById("teacher-logout"),
  studentLogout: document.getElementById("student-logout"),
  uploadMaterialForm: document.getElementById("upload-material-form"),
  replyDoubtForm: document.getElementById("reply-doubt-form"),
  uploadAnswerForm: document.getElementById("upload-answer-form"),
  askDoubtForm: document.getElementById("ask-doubt-form"),
  studentTitle: document.getElementById("student-title"),
  studentMaterials: document.getElementById("student-materials"),
  teacherSubmissions: document.getElementById("teacher-submissions"),
  doubtSelect: document.getElementById("doubt-select"),
  answerMaterialSelect: document.getElementById("answer-material-select"),
  doubtHistory: document.getElementById("doubt-history")
};

loadState();
wireEvents();
render();

function wireEvents() {
  els.teacherModeBtn.addEventListener("click", () => {
    els.teacherLoginForm.classList.remove("hidden");
    els.studentLoginForm.classList.add("hidden");
  });

  els.studentModeBtn.addEventListener("click", () => {
    els.studentLoginForm.classList.remove("hidden");
    els.teacherLoginForm.classList.add("hidden");
  });

  els.teacherLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("teacher-username").value.trim();
    const password = document.getElementById("teacher-password").value;

    if (username === TEACHER_CREDENTIALS.username && password === TEACHER_CREDENTIALS.password) {
      state.session = { role: "teacher" };
      render();
      return;
    }

    alert("Invalid teacher credentials. Use teacher / admin123 for demo.");
  });

  els.studentLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("student-id").value.trim().toUpperCase();
    const name = document.getElementById("student-name").value.trim();
    if (!id || !name) {
      return;
    }

    ensureStudent(id, name);
    state.session = { role: "student", id };
    persist();
    render();
  });

  els.teacherLogout.addEventListener("click", () => logout());
  els.studentLogout.addEventListener("click", () => logout());

  els.uploadMaterialForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentId = document.getElementById("material-student-id").value.trim().toUpperCase();
    const studentName = document.getElementById("material-student-name").value.trim();
    const type = document.getElementById("material-type").value;
    const title = document.getElementById("material-title").value.trim();
    const description = document.getElementById("material-description").value.trim();
    const file = document.getElementById("material-file").files[0];

    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      return;
    }

    const fileData = await fileToDataUrl(file);
    const student = ensureStudent(studentId, studentName);

    student.materials.unshift({
      id: crypto.randomUUID(),
      type,
      title,
      description,
      fileName: file.name,
      fileData,
      uploadedAt: new Date().toISOString()
    });

    persist();
    els.uploadMaterialForm.reset();
    renderTeacher();
  });

  els.uploadAnswerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const student = currentStudent();
    if (!student) return;

    const materialId = els.answerMaterialSelect.value;
    const file = document.getElementById("answer-file").files[0];

    if (!file || file.type !== "application/pdf") {
      alert("Please upload answer sheet as PDF.");
      return;
    }

    const fileData = await fileToDataUrl(file);
    student.submissions.unshift({
      id: crypto.randomUUID(),
      materialId,
      materialTitle: findMaterialTitle(student, materialId),
      fileName: file.name,
      fileData,
      submittedAt: new Date().toISOString()
    });

    persist();
    els.uploadAnswerForm.reset();
    renderStudent();
  });

  els.askDoubtForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const student = currentStudent();
    if (!student) return;

    const message = document.getElementById("doubt-message").value.trim();
    if (!message) return;

    student.doubts.unshift({
      id: crypto.randomUUID(),
      message,
      reply: "",
      askedAt: new Date().toISOString()
    });

    persist();
    els.askDoubtForm.reset();
    renderStudent();
    renderTeacher();
  });

  els.replyDoubtForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const token = els.doubtSelect.value;
    const reply = document.getElementById("doubt-reply").value.trim();
    if (!token || !reply) return;

    const [studentId, doubtId] = token.split("::");
    const student = state.data.students[studentId];
    if (!student) return;

    const doubt = student.doubts.find((d) => d.id === doubtId);
    if (!doubt) return;

    doubt.reply = reply;
    doubt.repliedAt = new Date().toISOString();

    persist();
    els.replyDoubtForm.reset();
    renderTeacher();
  });
}

function render() {
  els.teacherDashboard.classList.add("hidden");
  els.studentDashboard.classList.add("hidden");
  els.loginSection.classList.add("hidden");

  if (!state.session) {
    els.loginSection.classList.remove("hidden");
    return;
  }

  if (state.session.role === "teacher") {
    els.teacherDashboard.classList.remove("hidden");
    renderTeacher();
    return;
  }

  els.studentDashboard.classList.remove("hidden");
  renderStudent();
}

function renderTeacher() {
  const allSubmissions = Object.values(state.data.students).flatMap((student) =>
    student.submissions.map((s) => ({ ...s, studentId: student.id, studentName: student.name }))
  );

  els.teacherSubmissions.innerHTML = "";
  if (!allSubmissions.length) {
    els.teacherSubmissions.textContent = "No submissions yet.";
  } else {
    allSubmissions.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "item";
      item.innerHTML = `
        <h4>${escapeHtml(entry.studentName)} (${escapeHtml(entry.studentId)})</h4>
        <p>For: ${escapeHtml(entry.materialTitle || "Unknown material")}</p>
        <p class="small">Submitted: ${formatDate(entry.submittedAt)}</p>
        <a href="${entry.fileData}" download="${escapeHtml(entry.fileName)}">Download Answer PDF</a>
      `;
      els.teacherSubmissions.appendChild(item);
    });
  }

  const doubts = [];
  Object.values(state.data.students).forEach((student) => {
    student.doubts.forEach((doubt) => {
      if (!doubt.reply) {
        doubts.push({ ...doubt, studentId: student.id, studentName: student.name });
      }
    });
  });

  els.doubtSelect.innerHTML = "";
  if (!doubts.length) {
    els.doubtSelect.innerHTML = '<option value="">No pending doubts</option>';
    return;
  }

  doubts.forEach((doubt) => {
    const option = document.createElement("option");
    option.value = `${doubt.studentId}::${doubt.id}`;
    option.textContent = `${doubt.studentName} (${doubt.studentId}) - ${doubt.message.slice(0, 50)}`;
    els.doubtSelect.appendChild(option);
  });
}

function renderStudent() {
  const student = currentStudent();
  if (!student) return;

  els.studentTitle.textContent = `Student Dashboard: ${student.name} (${student.id})`;

  els.studentMaterials.innerHTML = "";
  if (!student.materials.length) {
    els.studentMaterials.textContent = "No notes, updates, or tests assigned yet.";
  } else {
    student.materials.forEach((mat) => {
      const item = document.createElement("article");
      item.className = "item";
      item.innerHTML = `
        <h4>${escapeHtml(mat.title)} <span class="small">[${escapeHtml(mat.type)}]</span></h4>
        <p>${escapeHtml(mat.description || "No description")}</p>
        <p class="small">Uploaded: ${formatDate(mat.uploadedAt)}</p>
        <a href="${mat.fileData}" target="_blank" rel="noopener">View PDF</a>
      `;
      els.studentMaterials.appendChild(item);
    });
  }

  const testLike = student.materials.filter((m) => m.type === "test" || m.type === "exam");
  els.answerMaterialSelect.innerHTML = "";
  if (!testLike.length) {
    els.answerMaterialSelect.innerHTML = '<option value="">No tests available</option>';
  } else {
    testLike.forEach((m) => {
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = `${m.title} (${formatDate(m.uploadedAt)})`;
      els.answerMaterialSelect.appendChild(option);
    });
  }

  els.doubtHistory.innerHTML = "";
  if (!student.doubts.length) {
    els.doubtHistory.textContent = "No doubts submitted yet.";
    return;
  }

  student.doubts.forEach((doubt) => {
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <p><strong>Q:</strong> ${escapeHtml(doubt.message)}</p>
      <p class="small">Asked: ${formatDate(doubt.askedAt)}</p>
      <p><strong>Teacher Reply:</strong> ${escapeHtml(doubt.reply || "Pending")}</p>
    `;
    els.doubtHistory.appendChild(item);
  });
}

function ensureStudent(id, name) {
  if (!state.data.students[id]) {
    state.data.students[id] = {
      id,
      name,
      materials: [],
      submissions: [],
      doubts: []
    };
  } else if (name) {
    state.data.students[id].name = name;
  }

  return state.data.students[id];
}

function currentStudent() {
  if (!state.session || state.session.role !== "student") return null;
  return state.data.students[state.session.id] || null;
}

function findMaterialTitle(student, materialId) {
  const material = student.materials.find((m) => m.id === materialId);
  return material ? material.title : "Unknown";
}

function logout() {
  state.session = null;
  render();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.students) {
      state.data = parsed;
    }
  } catch {
    state.data = { students: {} };
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString();
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
