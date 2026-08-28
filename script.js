/**
 * 专业大咖 — 多身份表单
 * 角色切换、推荐人路径、localStorage、Discord
 */

const STORAGE_KEY = "zhuanye_daka_leads";
/** Discord webhook disabled — set to a webhook URL to re-enable notifications. */
const DISCORD_WEBHOOK_URL = "";

const RESERVED_SLUGS = new Set([
  "assets",
  "examples",
  "index.html",
  "404.html",
  "script.js",
  "styles.css",
  "favicon.ico",
]);

const ROLE_CONFIG = {
  seeker: {
    label: "考生（咨询者）",
    title: "预约专业大咖咨询",
    desc: "填写以下信息后，我们会尽快联系你，帮你匹配合适的大咖。",
    successBody: "大咖AI找到人选后会联系你！",
    required: ["name", "contact", "major", "schoolLevel"],
  },
  expert: {
    label: "大咖",
    title: "提交大咖信息",
    desc: "填写你的基本信息，我们会尽快联系并完成匹配入驻。",
    successBody: "感谢提交，我们会尽快联系你完成大咖入驻。",
    required: ["name", "contact", "expertOrg", "expertMajor"],
  },
  advisor: {
    label: "高报师",
    title: "提交高报师信息",
    desc: "提交后会生成你的专属推荐链接，分享后自动享受 20% 渠道分成。",
    successBody: "提交成功！请使用你的专属链接进行推荐。",
    required: ["name", "contact"],
  },
};

const form = document.getElementById("lead-form");
const formCard = document.getElementById("form-card");
const successCard = document.getElementById("success-card");
const btnNewLead = document.getElementById("btn-new-lead");
const btnSubmit = document.getElementById("btn-submit");
const btnSubmitLabel = document.getElementById("btn-submit-label");
const formSubmitError = document.getElementById("form-submit-error");
const formTitle = document.getElementById("form-title");
const formDesc = document.getElementById("form-desc");
const nameLabel = document.getElementById("name-label");
const contactLabel = document.getElementById("contact-label");
const contactHint = document.getElementById("contact-hint");
const referrerLine = document.getElementById("referrer-line");
const referrerNameEl = document.getElementById("referrer-name");
const roleInputs = document.querySelectorAll('input[name="visitorRole"]');

const successRole = document.getElementById("success-role");
const successBody = document.getElementById("success-body");
const successMajorLabel = document.getElementById("success-major-label");
const successSchoolLabel = document.getElementById("success-school-label");
const successSchoolRow = document.getElementById("success-school-row");
const successReferrerRow = document.getElementById("success-referrer-row");
const advisorLinkBox = document.getElementById("advisor-link-box");
const advisorLinkEl = document.getElementById("advisor-link");

const fields = {
  name: document.getElementById("name"),
  contact: document.getElementById("contact"),
  major: document.getElementById("major"),
  schoolLevel: document.getElementById("schoolLevel"),
  note: document.getElementById("note"),
  expertOrg: document.getElementById("expertOrg"),
  expertMajor: document.getElementById("expertMajor"),
};

const errorEls = {
  name: document.querySelector('[data-error-for="name"]'),
  contact: document.querySelector('[data-error-for="contact"]'),
  major: document.querySelector('[data-error-for="major"]'),
  schoolLevel: document.querySelector('[data-error-for="schoolLevel"]'),
  expertOrg: document.querySelector('[data-error-for="expertOrg"]'),
  expertMajor: document.querySelector('[data-error-for="expertMajor"]'),
};

const successEls = {
  referrer: document.getElementById("success-referrer"),
  name: document.getElementById("success-name"),
  major: document.getElementById("success-major"),
  school: document.getElementById("success-school"),
};

const ERROR_MESSAGES = {
  name: "请输入称呼",
  contact: "请输入联系方式",
  major: "请输入意向专业",
  schoolLevel: "请选择学校层级",
  expertOrg: "请输入公司或学校",
  expertMajor: "请输入专业",
};

let activeRole = "seeker";
let activeReferrer = null;
let latestAdvisorLink = "";

function slugFromPathname() {
  const segment = window.location.pathname
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean)[0];
  if (!segment || segment.includes(".")) return null;
  if (RESERVED_SLUGS.has(segment.toLowerCase())) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function slugFromQuery() {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref || !ref.trim()) return null;
  let slug;
  try {
    slug = decodeURIComponent(ref.trim());
  } catch {
    slug = ref.trim();
  }
  if (slug.includes("/") || slug.includes(".")) return null;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return null;
  return slug;
}

function persistReferrerSlug(slug) {
  try {
    sessionStorage.setItem("referrerSlug", slug);
  } catch {
    /* ignore */
  }
}

function formatReferrerName(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function initReferrer() {
  let slug = slugFromQuery() || slugFromPathname();
  if (!slug) {
    try {
      const stored = sessionStorage.getItem("referrerSlug");
      if (stored) {
        slug = stored;
        sessionStorage.removeItem("referrerSlug");
      }
    } catch {
      /* ignore */
    }
  }
  if (!slug) {
    activeReferrer = null;
    return;
  }
  persistReferrerSlug(slug);
  activeReferrer = { slug, name: formatReferrerName(slug) };
  const cleanPath = `/${encodeURIComponent(slug)}`;
  if (
    window.location.pathname === "/" ||
    window.location.pathname === "" ||
    window.location.pathname === cleanPath ||
    window.location.search.includes("ref=")
  ) {
    window.history.replaceState(null, "", cleanPath);
  }
}

function applyReferrerToForm() {
  if (!referrerLine || !referrerNameEl) return;
  if (!activeReferrer) {
    referrerLine.hidden = true;
    referrerNameEl.textContent = "";
    return;
  }
  referrerLine.hidden = false;
  referrerNameEl.textContent = activeReferrer.name;
}

function clearErrors() {
  Object.keys(errorEls).forEach((key) => {
    if (errorEls[key]) errorEls[key].textContent = "";
    if (fields[key]) fields[key].classList.remove("error");
  });
}

function sanitizeSlugPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildAdvisorLink(contact) {
  const contactPart = sanitizeSlugPart(contact);
  const slug = contactPart || "advisor";
  return `https://ai.voce.chat/${encodeURIComponent(slug)}`;
}

function setRole(role) {
  activeRole = ROLE_CONFIG[role] ? role : "seeker";
  const conf = ROLE_CONFIG[activeRole];

  if (formTitle) formTitle.textContent = conf.title;
  if (formDesc) formDesc.textContent = conf.desc;
  if (nameLabel) nameLabel.textContent = "称呼";
  if (contactLabel) contactLabel.textContent = "联系方式";
  if (activeRole === "seeker") {
    if (fields.name) fields.name.placeholder = "例如：小明 / 小明妈妈";
    if (fields.contact) fields.contact.placeholder = "微信号或手机号";
    if (contactHint) contactHint.textContent = "必须有联系方式，否则无法联系你。";
  } else if (activeRole === "expert") {
    if (fields.name) fields.name.placeholder = "例如：李学长 / 王老师";
    if (fields.contact) {
      fields.contact.placeholder = "微信号或手机号（便于后续匹配沟通）";
    }
    if (fields.expertOrg) fields.expertOrg.placeholder = "例如：腾讯 / 复旦大学";
    if (fields.expertMajor) {
      fields.expertMajor.placeholder = "例如：计算机科学 / 金融工程";
    }
    if (contactHint) {
      contactHint.textContent = "请填写可直接联系到你的微信号或手机号。";
    }
  } else {
    if (fields.name) fields.name.placeholder = "例如：张老师";
    if (fields.contact) {
      fields.contact.placeholder = "微信号或手机";
    }
    if (contactHint) {
      contactHint.textContent = "提交后将生成你的专属推荐链接，用于渠道分成。";
    }
  }

  const showSeeker = activeRole === "seeker";
  const showExpert = activeRole === "expert";

  document.querySelectorAll(".role-seeker").forEach((el) => {
    el.classList.toggle("hidden", !showSeeker);
  });
  document.querySelectorAll(".role-expert").forEach((el) => {
    el.classList.toggle("hidden", !showExpert);
  });

  clearErrors();
}

function validate() {
  clearErrors();
  let valid = true;
  const required = ROLE_CONFIG[activeRole].required;

  required.forEach((key) => {
    const value = fields[key]?.value.trim();
    if (!value) {
      valid = false;
      if (errorEls[key]) errorEls[key].textContent = ERROR_MESSAGES[key];
      if (fields[key]) fields[key].classList.add("error");
    }
  });
  return valid;
}

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

function saveLead(formData) {
  const leads = getLeads();
  leads.push(formData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

function discordFieldValue(value, maxLen = 1024) {
  const text = String(value ?? "").trim() || "—";
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

async function sendToDiscord(formData) {
  const submittedAt = new Date(formData.submittedAt);
  const timeLabel = submittedAt.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  const embedFields = [
    { name: "身份", value: discordFieldValue(ROLE_CONFIG[formData.role].label), inline: true },
    { name: "称呼", value: discordFieldValue(formData.name), inline: true },
    { name: "联系方式", value: discordFieldValue(formData.contact), inline: true },
  ];

  if (formData.role === "seeker") {
    embedFields.push(
      { name: "意向专业", value: discordFieldValue(formData.major), inline: true },
      { name: "学校层级", value: discordFieldValue(formData.schoolLevel), inline: true },
      { name: "备注", value: discordFieldValue(formData.note || "（无）"), inline: false }
    );
  }

  if (formData.role === "expert") {
    embedFields.push(
      { name: "公司或学校", value: discordFieldValue(formData.expertOrg), inline: true },
      { name: "专业", value: discordFieldValue(formData.expertMajor), inline: true }
    );
  }

  if (formData.role === "advisor") {
    embedFields.push({
      name: "专属推荐链接",
      value: discordFieldValue(formData.advisorLink),
      inline: false,
    });
  }

  if (formData.referrerName) {
    embedFields.push({
      name: "推荐人",
      value: discordFieldValue(`${formData.referrerName} (${formData.referrerSlug})`),
      inline: true,
    });
  }

  embedFields.push({ name: "提交时间", value: timeLabel, inline: false });

  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "专业大咖 · 新信息提交",
        color: 0x0066ff,
        fields: embedFields,
        footer: { text: "专业大咖表单" },
        timestamp: formData.submittedAt,
      },
    ],
  };

  if (!DISCORD_WEBHOOK_URL) {
    console.warn("Discord webhook disabled; skipping notification.");
    return;
  }

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status}`);
}

function setSubmitting(isSubmitting) {
  if (btnSubmit) btnSubmit.disabled = isSubmitting;
  if (btnSubmitLabel) btnSubmitLabel.textContent = isSubmitting ? "提交中…" : "提交信息";
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

function setSuccessActionForRole(role) {
  if (!btnNewLead) return;
  if (role === "advisor") {
    btnNewLead.textContent = "复制我的渠道链接";
    return;
  }
  btnNewLead.textContent = "继续提交新的预约";
}

function showSuccess(formData) {
  if (successRole) successRole.textContent = ROLE_CONFIG[formData.role].label;
  if (successBody) successBody.textContent = ROLE_CONFIG[formData.role].successBody;

  if (successReferrerRow && successEls.referrer) {
    if (formData.referrerName) {
      successEls.referrer.textContent = formData.referrerName;
      successReferrerRow.classList.remove("hidden");
    } else {
      successReferrerRow.classList.add("hidden");
    }
  }

  if (successEls.name) successEls.name.textContent = formData.name;

  if (formData.role === "seeker") {
    if (successMajorLabel) successMajorLabel.textContent = "意向专业";
    if (successSchoolLabel) successSchoolLabel.textContent = "学校层级";
    if (successEls.major) successEls.major.textContent = formData.major;
    if (successEls.school) successEls.school.textContent = formData.schoolLevel;
    if (successSchoolRow) successSchoolRow.classList.remove("hidden");
  } else if (formData.role === "expert") {
    if (successMajorLabel) successMajorLabel.textContent = "公司或学校";
    if (successSchoolLabel) successSchoolLabel.textContent = "专业";
    if (successEls.major) successEls.major.textContent = formData.expertOrg;
    if (successEls.school) successEls.school.textContent = formData.expertMajor;
    if (successSchoolRow) successSchoolRow.classList.remove("hidden");
  } else {
    if (successMajorLabel) successMajorLabel.textContent = "联系方式";
    if (successEls.major) successEls.major.textContent = formData.contact;
    if (successSchoolRow) successSchoolRow.classList.add("hidden");
  }

  if (advisorLinkBox && advisorLinkEl) {
    if (formData.role === "advisor" && formData.advisorLink) {
      latestAdvisorLink = formData.advisorLink;
      advisorLinkEl.href = formData.advisorLink;
      advisorLinkEl.textContent = formData.advisorLink.replace(/^https?:\/\//, "");
      advisorLinkBox.classList.remove("hidden");
    } else {
      latestAdvisorLink = "";
      advisorLinkBox.classList.add("hidden");
      advisorLinkEl.textContent = "";
      advisorLinkEl.href = "#";
    }
  }

  setSuccessActionForRole(formData.role);
  formCard.classList.add("hidden");
  successCard.classList.remove("hidden");
}

function showForm() {
  successCard.classList.add("hidden");
  formCard.classList.remove("hidden");
  form.reset();
  const defaultRole = form.querySelector('input[name="visitorRole"][value="seeker"]');
  if (defaultRole) defaultRole.checked = true;
  setRole("seeker");
  applyReferrerToForm();
  clearErrors();
  clearFormSubmitError();
  setSubmitting(false);
  setSuccessActionForRole("seeker");
}

async function handleSuccessAction() {
  if (activeRole === "advisor" && latestAdvisorLink) {
    try {
      await navigator.clipboard.writeText(latestAdvisorLink);
      btnNewLead.textContent = "已复制渠道链接";
      return;
    } catch {
      showFormSubmitError("复制失败，请手动复制上方链接。");
      return;
    }
  }
  showForm();
}

async function handleSubmit(e) {
  e.preventDefault();
  clearFormSubmitError();
  if (!validate()) return;

  const formData = {
    role: activeRole,
    name: fields.name.value.trim(),
    contact: fields.contact.value.trim(),
    major: fields.major.value.trim(),
    schoolLevel: fields.schoolLevel.value.trim(),
    note: fields.note.value.trim(),
    expertOrg: fields.expertOrg.value.trim(),
    expertMajor: fields.expertMajor.value.trim(),
    submittedAt: new Date().toISOString(),
  };

  if (activeRole === "advisor") {
    formData.advisorLink = buildAdvisorLink(formData.contact);
  }

  if (activeReferrer) {
    formData.referrerSlug = activeReferrer.slug;
    formData.referrerName = activeReferrer.name;
  }

  setSubmitting(true);
  try {
    await sendToDiscord(formData);
    saveLead(formData);
    showSuccess(formData);
  } catch (err) {
    console.error("submit failed:", err);
    showFormSubmitError("提交失败，请检查网络后重试。若问题持续，请直接联系我们。");
  } finally {
    setSubmitting(false);
  }
}

initReferrer();
applyReferrerToForm();
setRole("seeker");

form.addEventListener("submit", handleSubmit);
btnNewLead.addEventListener("click", handleSuccessAction);

roleInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    setRole(input.value);
  });
});

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
