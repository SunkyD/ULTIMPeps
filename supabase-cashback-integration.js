/* ULTIM'Peps — cashback manuel partagé avec Supabase.
   Nécessite la migration supabase-cashback-adjustments.sql. */
(function () {
  "use strict";
  const sb = window.ULTIM_SUPABASE;
  if (!sb || typeof window.cbCalc !== "function") return;

  const cfg = window.ULTIM_CONFIG || {};
  const adminEmail = String(cfg.adminEmail || "").toLowerCase();
  const originalCalc = window.cbCalc;
  const adjustmentsByEmail = new Map();
  let isAdmin = false;
  let refreshChain = Promise.resolve();

  const emailKey = value => String(value || "").trim().toLowerCase();
  const round2 = value => Math.round((Number(value) || 0) * 100) / 100;
  const money = value => new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR"
  }).format(value);

  function sumAdjustments(email) {
    return round2((adjustmentsByEmail.get(emailKey(email)) || [])
      .reduce((sum, row) => {
        const amount = Math.abs(Number(row.amount || 0));
        return sum + (String(row.direction || "credit").toLowerCase() === "debit" ? -amount : amount);
      }, 0));
  }

  window.cbCalc = function (email) {
    const base = originalCalc.apply(this, arguments);
    const adjustment = sumAdjustments(email);
    return {
      ...base,
      bal: Math.max(0, round2(Number(base.bal || 0) + adjustment)),
      manualAdjustment: adjustment
    };
  };

  async function refreshAdjustments() {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session;
    isAdmin = emailKey(session && session.user && session.user.email) === adminEmail;
    if (!session || !session.user || !session.user.email) return false;

    let query = sb.from("store_cashback_adjustments")
      .select("id,customer_email,amount,direction,reason,created_at,created_by")
      .order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("customer_email", emailKey(session.user.email));

    const { data, error } = await query;
    if (error) throw error;

    adjustmentsByEmail.clear();
    for (const row of data || []) {
      const key = emailKey(row.customer_email);
      if (!adjustmentsByEmail.has(key)) adjustmentsByEmail.set(key, []);
      adjustmentsByEmail.get(key).push(row);
    }

    // Rafraîchit les montants affichés sans toucher aux autres données du compte.
    try { if (isAdmin && typeof window.ulist === "function") window.ulist(); } catch (_) {}
    try { if (!isAdmin && typeof window.arender === "function") window.arender(); } catch (_) {}
    return true;
  }

  function decorateCustomerCards() {
    if (!isAdmin) return;
    const root = document.getElementById("ul2");
    if (!root) return;
    root.querySelectorAll(".oc").forEach(card => {
      const emailNode = card.querySelector(".oh small");
      const email = emailKey(emailNode && emailNode.textContent);
      if (!email || !email.includes("@")) return;
      const actions = card.querySelector(".oa");
      if (!actions || actions.querySelector("[data-cashback-adjust]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.cashbackAdjust = email;
      button.className = "pri";
      button.textContent = "Ajuster le cashback";
      actions.prepend(button);
    });
  }

  const originalUlist = window.ulist;
  if (typeof originalUlist === "function") {
    window.ulist = function () {
      const result = originalUlist.apply(this, arguments);
      Promise.resolve().then(decorateCustomerCards);
      return result;
    };
  }

  document.addEventListener("click", async event => {
    const button = event.target && event.target.closest
      ? event.target.closest("[data-cashback-adjust]") : null;
    if (!button) return;
    event.preventDefault();
    if (!isAdmin) {
      window.toast && window.toast("Connecte-toi avec le compte administrateur.");
      return;
    }

    const email = emailKey(button.dataset.cashbackAdjust);
    const rawAmount = window.prompt(
      "Ajustement pour " + email + " (euros). Positif = crédit, négatif = débit :",
      "5.00"
    );
    if (rawAmount === null) return;
    const normalized = String(rawAmount).trim().replace(",", ".");
    const amount = Number(normalized);
    if (!normalized || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) {
      window.toast && window.toast("Montant invalide. Saisis un montant non nul entre -100000 et 100000 €.");
      return;
    }

    const reason = window.prompt("Motif de l'ajustement (obligatoire) :", "Ajustement manuel admin");
    if (reason === null) return;
    if (reason.trim().length < 2 || reason.trim().length > 300) {
      window.toast && window.toast("Le motif doit contenir entre 2 et 300 caractères.");
      return;
    }

    button.disabled = true;
    try {
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData && sessionData.session;
      if (emailKey(session && session.user && session.user.email) !== adminEmail) {
        throw new Error("Session administrateur invalide. Reconnecte-toi.");
      }
      const { error } = await sb.from("store_cashback_adjustments").insert({
        customer_email: email,
        amount: round2(Math.abs(amount)),
        direction: amount > 0 ? "credit" : "debit",
        reason: reason.trim(),
        admin_user_id: session.user.id,
        created_by: session.user.id
      });
      if (error) throw error;
      await refreshAdjustments();
      decorateCustomerCards();
      window.toast && window.toast("Ajustement cashback enregistré dans Supabase ✔");
    } catch (error) {
      console.error("Ajustement cashback Supabase :", error);
      window.toast && window.toast("Enregistrement impossible : " + (error.message || "vérifie que la migration SQL est exécutée."));
    } finally {
      button.disabled = false;
    }
  });

  sb.auth.onAuthStateChange(() => {
    refreshChain = refreshChain.then(refreshAdjustments).catch(error => {
      console.warn("Chargement des ajustements cashback :", error.message);
    });
  });

  refreshChain = refreshChain.then(refreshAdjustments).catch(error => {
    console.warn("Cashback Supabase non chargé :", error.message);
  });
})();
