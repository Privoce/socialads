/**
 * 专业大咖 — 预约表单
 * 校验、localStorage、成功状态
 */

const STORAGE_KEY = "zhuanye_daka_leads";
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1508682343601279187/1IGucWVSrSKkHKBhuGpr4Y7-Oq02t7cuIE0PMYr6MgW-lxaoFVR-93Iy7ouri_4KUX5e";

const form = document.getElementById("lead-form");
const formCard = document.getElementById("form-card");
const successCard = document.getElementById("success-card");
const btnNewLead = document.getElementById("btn-new-lead");
const btnSubmit = document.getElementById("btn-submit");
const btnSubmitLabel = document.getElementById("btn-submit-label");
const formSubmitError = document.getElementById("form-submit-error");

const fields = {
  name: document.getElementById("name"),
  contact: document.getElementById("contact"),
  major: document.getElementById("major"),
  schoolLevel: document.getElementById("schoolLevel"),
  note: document.getElementById("note"),
};

const errorEls = {
  name: document.querySelector('[data-error-for="name"]'),
  contact: document.querySelector('[data-error-for="contact"]'),
  major: document.querySelector('[data-error-for="major"]'),
  schoolLevel: document.querySelector('[data-error-for="schoolLevel"]'),
};

const successEls = {
  name: document.getElementById("success-name"),
  major: document.getElementById("success-major"),
  school: document.getElementById("success-school"),
};

const ERROR_MESSAGES = {
  name: "请输入姓名",
  contact: "请输入联系方式",
  major: "请输入意向专业",
  schoolLevel: "请选择学校层级",
};

/** 清除所有错误提示 */
function clearErrors() {
  Object.keys(errorEls).forEach((key) => {
    if (errorEls[key]) errorEls[key].textContent = "";
    if (fields[key]) fields[key].classList.remove("error");
  });
}

/** 校验必填字段，返回是否通过 */
function validate() {
  clearErrors();
  let valid = true;

  const checks = [
    { key: "name", value: fields.name?.value.trim() },
    { key: "contact", value: fields.contact?.value.trim() },
    { key: "major", value: fields.major?.value.trim() },
    { key: "schoolLevel", value: fields.schoolLevel?.value.trim() },
  ];

  checks.forEach(({ key, value }) => {
    if (!value) {
      valid = false;
      if (errorEls[key]) errorEls[key].textContent = ERROR_MESSAGES[key];
      if (fields[key]) fields[key].classList.add("error");
    }
  });

  return valid;
}

/** 从 localStorage 读取已有 leads */
function getLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 保存 lead 到 localStorage */
function saveLead(formData) {
  const leads = getLeads();
  leads.push(formData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

/** 截断并转义 Discord embed 字段内容 */
function discordFieldValue(value, maxLen = 1024) {
  const text = String(value ?? "").trim() || "—";
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

/** 发送到 Discord 频道 */
async function sendToDiscord(formData) {
  const submittedAt = new Date(formData.submittedAt);
  const timeLabel = submittedAt.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "专业大咖 · 新预约",
        color: 0x0066ff,
        fields: [
          { name: "姓名", value: discordFieldValue(formData.name), inline: true },
          {
            name: "联系方式",
            value: discordFieldValue(formData.contact),
            inline: true,
          },
          {
            name: "意向专业",
            value: discordFieldValue(formData.major),
            inline: true,
          },
          {
            name: "学校层级",
            value: discordFieldValue(formData.schoolLevel),
            inline: true,
          },
          {
            name: "备注",
            value: discordFieldValue(formData.note || "（无）"),
            inline: false,
          },
          {
            name: "提交时间",
            value: timeLabel,
            inline: false,
          },
        ],
        footer: { text: "专业大咖预约表单" },
        timestamp: formData.submittedAt,
      },
    ],
  };

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}

function setSubmitting(isSubmitting) {
  if (btnSubmit) btnSubmit.disabled = isSubmitting;
  if (btnSubmitLabel) {
    btnSubmitLabel.textContent = isSubmitting ? "提交中…" : "提交预约";
  }
}

function showFormSubmitError(message) {
  if (!formSubmitError) return;
  formSubmitError.textContent = message;
  formSubmitError.classList.remove("hidden");
}

function clearFormSubmitError() {
  if (!formSubmitError) return;
  formSubmitError.textContent = "";
  formSubmitError.classList.add("hidden");
}

/** 显示成功卡片 */
function showSuccess(formData) {
  if (successEls.name) successEls.name.textContent = formData.name;
  if (successEls.major) successEls.major.textContent = formData.major;
  if (successEls.school) successEls.school.textContent = formData.schoolLevel;

  formCard.classList.add("hidden");
  successCard.classList.remove("hidden");
}

/** 回到表单状态 */
function showForm() {
  successCard.classList.add("hidden");
  formCard.classList.remove("hidden");
  form.reset();
  clearErrors();
  clearFormSubmitError();
  setSubmitting(false);
}

/** 提交处理 */
async function handleSubmit(e) {
  e.preventDefault();
  clearFormSubmitError();

  if (!validate()) return;

  const formData = {
    name: fields.name.value.trim(),
    contact: fields.contact.value.trim(),
    major: fields.major.value.trim(),
    schoolLevel: fields.schoolLevel.value.trim(),
    note: fields.note.value.trim(),
    submittedAt: new Date().toISOString(),
  };

  setSubmitting(true);

  try {
    await sendToDiscord(formData);
    saveLead(formData);
    console.log("lead submitted:", formData);
    showSuccess(formData);
  } catch (err) {
    console.error("submit failed:", err);
    showFormSubmitError(
      "提交失败，请检查网络后重试。若问题持续，请直接联系我们。"
    );
  } finally {
    setSubmitting(false);
  }
}

form.addEventListener("submit", handleSubmit);
btnNewLead.addEventListener("click", showForm);

// 输入时清除对应字段错误
Object.keys(fields).forEach((key) => {
  const el = fields[key];
  if (!el || !errorEls[key]) return;
  const eventName = el.tagName === "SELECT" ? "change" : "input";
  el.addEventListener(eventName, () => {
    if (el.value.trim()) {
      errorEls[key].textContent = "";
      el.classList.remove("error");
    }
  });
});
