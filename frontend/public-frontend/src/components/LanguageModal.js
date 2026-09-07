import React from "react";
import appLogo from "../logo.svg";
import { SUPPORTED_LANGUAGES, t } from "../constants/translations";
import "./LanguageModal.css";

function LanguageModal({ isOpen, onClose, currentLanguage, onLanguageChange }) {
  if (!isOpen) return null;

  return (
    <div className="language-modal-overlay" onClick={onClose}>
      <div className="language-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="language-modal-head">
          <img src={appLogo} alt="SANITRAX Logo" className="language-modal-logo" />
          <h2 className="language-modal-title">🌐 {t("select_language", currentLanguage)}</h2>
        </div>

        <div className="language-lang-grid">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`language-lang-btn ${currentLanguage === lang.code ? "active" : ""}`}
              onClick={() => {
                onLanguageChange(lang.code);
                if (onClose) onClose();
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="language-modal-footer">
          <button type="button" className="language-close-btn" onClick={onClose}>
            {t("close", currentLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguageModal;
