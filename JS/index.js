document.addEventListener("DOMContentLoaded", () => {
  // --- How it Works Statistic ---
  const howitworkCount = document.querySelector(".howitwork-count");
  if (howitworkCount) {
    const target = Number(howitworkCount.dataset.count);
    const suffix = howitworkCount.dataset.suffix || "";
    const duration = 1200;

    const animateCount = () => {
      const startTime = performance.now();
      const updateCount = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        howitworkCount.textContent = `${Math.round(target * progress)}${suffix}`;
        if (progress < 1) requestAnimationFrame(updateCount);
      };
      requestAnimationFrame(updateCount);
    };

    const countObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        animateCount();
        countObserver.disconnect();
      }
    }, { threshold: 0.4 });
    countObserver.observe(howitworkCount);
  }

  // --- Dropdowns Logic ---
  const productsTrigger = document.getElementById("products-dropdown-trigger");
  const productsDropdown = document.getElementById("products-dropdown");
  const productsAccordion = document.getElementById("mi-nav-products-accordion");
  
  const communityTrigger = document.getElementById("community-dropdown-trigger");
  const communityDropdown = document.getElementById("community-dropdown");
  const communityAccordion = document.getElementById("mi-nav-community-accordion");
  
  const backdrop = document.getElementById("dropdown-backdrop");
  
  function closeAllDropdowns() {
    if (productsDropdown) productsDropdown.classList.remove("active");
    if (productsTrigger) productsTrigger.classList.remove("active");
    
    if (communityDropdown) communityDropdown.classList.remove("active");
    if (communityTrigger) communityTrigger.classList.remove("active");
    
    if (backdrop) backdrop.classList.remove("active");
  }

  if (productsTrigger && productsDropdown) {
    productsTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.innerWidth <= 1300) {
        const isOpen = productsAccordion?.classList.contains("is-open");
        productsAccordion?.classList.toggle("is-open", !isOpen);
        productsTrigger.classList.toggle("is-accordion-open", !isOpen);
        return;
      }
      const isActive = productsDropdown.classList.contains("active");
      closeAllDropdowns();
      if (!isActive) {
        productsDropdown.classList.add("active");
        productsTrigger.classList.add("active");
        if (backdrop) backdrop.classList.add("active");
      }
    });
  }
  
  if (communityTrigger && communityDropdown) {
    communityTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.innerWidth <= 1300) {
        const isOpen = communityAccordion?.classList.contains("is-open");
        communityAccordion?.classList.toggle("is-open", !isOpen);
        communityTrigger.classList.toggle("is-accordion-open", !isOpen);
        return;
      }
      const isActive = communityDropdown.classList.contains("active");
      closeAllDropdowns();
      if (!isActive) {
        communityDropdown.classList.add("active");
        communityTrigger.classList.add("active");
        if (backdrop) backdrop.classList.add("active");
      }
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    const clickedInProducts = productsTrigger?.contains(e.target) || productsDropdown?.contains(e.target);
    const clickedInCommunity = communityTrigger?.contains(e.target) || communityDropdown?.contains(e.target);
    if (!clickedInProducts && !clickedInCommunity) {
      closeAllDropdowns();
    }
  });

  // --- Mobile hamburger nav ---
  // The navigation and remaining actions relocate into the hamburger panel
  // on mobile. The existing signup action stays visible in the navbar.
  const navHamburger = document.getElementById("nav-hamburger-toggle");
  const navMobilePanel = document.getElementById("nav-mobile-panel");
  const navMobilePanelClose = document.getElementById("nav-mobile-panel-close");
  const navMobilePanelSignup = document.getElementById("nav-mobile-panel-signup");
  const navMobilePanelActions = document.querySelector(".mi-nav-mobile-panel-actions");
  const navMobileLinksSlot = document.getElementById("nav-mobile-links-slot");
  const navMobileActionsSlot = document.getElementById("nav-mobile-actions-slot");
  const navMobileCtaSlot = document.getElementById("nav-mobile-cta-slot");
  const signinButton = document.getElementById("auth-signin-btn");
  const signupButton = document.getElementById("auth-signup-btn");
  const dashboardButton = document.getElementById("auth-dashboard-btn");
  const NAV_MOBILE_BREAKPOINT = 1300;
  let navMobileRelocated = false;

  const navLinksAnchor = (() => {
    const el = document.querySelector(".nav-links");
    return el ? { el, parent: el.parentNode, next: el.nextSibling } : null;
  })();
  const navActionsAnchor = (() => {
    const el = document.querySelector(".nav-actions");
    return el ? { el, parent: el.parentNode, next: el.nextSibling } : null;
  })();
  const signupButtonAnchor = signupButton
    ? { el: signupButton, parent: signupButton.parentNode, next: signupButton.nextSibling }
    : null;
  const signinButtonAnchor = signinButton
    ? { el: signinButton, parent: signinButton.parentNode, next: signinButton.nextSibling }
    : null;
  const dashboardButtonAnchor = dashboardButton
    ? { el: dashboardButton, parent: dashboardButton.parentNode, next: dashboardButton.nextSibling }
    : null;
  const productsDropdownAnchor = productsDropdown
    ? { el: productsDropdown, parent: productsDropdown.parentNode, next: productsDropdown.nextSibling }
    : null;
  const communityDropdownAnchor = communityDropdown
    ? { el: communityDropdown, parent: communityDropdown.parentNode, next: communityDropdown.nextSibling }
    : null;

  function isMobileNavLayout() {
    return window.innerWidth <= NAV_MOBILE_BREAKPOINT;
  }

  function relocateNavForMobile() {
    if (navMobileRelocated || !navMobileLinksSlot || !navMobileActionsSlot || !navMobileCtaSlot) return;
    if (navLinksAnchor) navMobileLinksSlot.appendChild(navLinksAnchor.el);
    if (navActionsAnchor) navMobileActionsSlot.appendChild(navActionsAnchor.el);
    if (signupButtonAnchor) navMobileCtaSlot.appendChild(signupButtonAnchor.el);
    if (dashboardButtonAnchor) navMobileCtaSlot.appendChild(dashboardButtonAnchor.el);
    if (signinButtonAnchor && navMobilePanelActions) navMobilePanelActions.appendChild(signinButtonAnchor.el);
    if (productsAccordion && productsDropdownAnchor) productsAccordion.appendChild(productsDropdownAnchor.el);
    if (communityAccordion && communityDropdownAnchor) communityAccordion.appendChild(communityDropdownAnchor.el);
    navMobileRelocated = true;
  }

  function restoreNavFromMobile() {
    if (!navMobileRelocated) return;
    if (navLinksAnchor) navLinksAnchor.parent.insertBefore(navLinksAnchor.el, navLinksAnchor.next);
    if (navActionsAnchor) navActionsAnchor.parent.insertBefore(navActionsAnchor.el, navActionsAnchor.next);
    if (dashboardButtonAnchor) dashboardButtonAnchor.parent.insertBefore(dashboardButtonAnchor.el, dashboardButtonAnchor.next);
    if (signupButtonAnchor) signupButtonAnchor.parent.insertBefore(signupButtonAnchor.el, signupButtonAnchor.next);
    if (signinButtonAnchor) signinButtonAnchor.parent.insertBefore(signinButtonAnchor.el, signinButtonAnchor.next);
    if (productsDropdownAnchor) productsDropdownAnchor.parent.insertBefore(productsDropdownAnchor.el, productsDropdownAnchor.next);
    if (communityDropdownAnchor) communityDropdownAnchor.parent.insertBefore(communityDropdownAnchor.el, communityDropdownAnchor.next);
    navMobileRelocated = false;
  }

  function openNavMobilePanel() {
    if (!navMobilePanel) return;
    navMobilePanel.classList.add("is-open");
    document.body.classList.add("mi-nav-mobile-open");
    if (navHamburger) {
      navHamburger.classList.add("is-open");
      navHamburger.setAttribute("aria-expanded", "true");
    }
  }

  function closeNavMobilePanel() {
    if (!navMobilePanel) return;
    navMobilePanel.classList.remove("is-open");
    document.body.classList.remove("mi-nav-mobile-open");
    if (navHamburger) {
      navHamburger.classList.remove("is-open");
      navHamburger.setAttribute("aria-expanded", "false");
    }
  }

  function syncNavMobileLayout() {
    if (isMobileNavLayout()) {
      relocateNavForMobile();
    } else {
      restoreNavFromMobile();
      closeNavMobilePanel();
    }
  }

  syncNavMobileLayout();
  window.addEventListener("resize", syncNavMobileLayout);

  if (navHamburger) {
    navHamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (navMobilePanel.classList.contains("is-open")) {
        closeNavMobilePanel();
      } else {
        openNavMobilePanel();
      }
    });
  }

  if (navMobilePanelClose) {
    navMobilePanelClose.addEventListener("click", closeNavMobilePanel);
  }

  if (navMobilePanelSignup && signupButton) {
    navMobilePanelSignup.addEventListener("click", () => signupButton.click());
  }

  // Selecting a Products/Community trigger inside the relocated nav still
  // opens that dropdown (existing logic above) — close the hamburger panel
  // too so they don't stack visually.
  document.addEventListener("click", (e) => {
    if (navLinksAnchor && navLinksAnchor.el.contains(e.target) && !productsTrigger?.contains(e.target) && !communityTrigger?.contains(e.target)) {
      closeNavMobilePanel();
    }
  });

  document.addEventListener("click", (e) => {
    if (!navMobilePanel || !navMobilePanel.classList.contains("is-open")) return;
    if (navMobilePanel.contains(e.target)) return;
    if (navHamburger && navHamburger.contains(e.target)) return;
    closeNavMobilePanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNavMobilePanel();
  });

  // --- Button Liquid Glow & Jelly Effect ---
  const primaryBtns = document.querySelectorAll(".btn-primary-large, .howitwork-redesign-button");
  primaryBtns.forEach(primaryBtn => {
    let jellyLock = false;

    primaryBtn.addEventListener("mousemove", (e) => {
      const rect = primaryBtn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      primaryBtn.style.setProperty("--x", `${x}px`);
      primaryBtn.style.setProperty("--y", `${y}px`);
    });

    primaryBtn.addEventListener("mouseenter", () => {
      if (primaryBtn.classList.contains("howitwork-redesign-button")) {
        primaryBtn.classList.remove("jelly-active");
        void primaryBtn.offsetWidth;
        primaryBtn.classList.add("jelly-active");
        return;
      }

      if (!jellyLock) {
        jellyLock = true;
        primaryBtn.classList.add("jelly-active");
        setTimeout(() => { jellyLock = false; }, 1000); // Prevent glitchy repeats for 1s
      }
    });

    primaryBtn.addEventListener("animationend", (e) => {
      if (e.animationName === 'jelly') {
        primaryBtn.classList.remove("jelly-active");
      }
    });
  });

  // --- Templates Slider Navigation ---
  const templatesSlider = document.querySelector(".templates-slider-container");
  const templatesPrevBtn = document.querySelector(".nav-btn.prev");
  const templatesNextBtn = document.querySelector(".nav-btn.next");
  const templatesTrack = templatesSlider?.querySelector(".templates-track");

  if (templatesSlider && templatesPrevBtn && templatesNextBtn && templatesTrack) {
    const originalCards = [...templatesTrack.children];
    const createCloneGroup = () => originalCards.map((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.inert = true;
      return clone;
    });
    const leadingClones = [...createCloneGroup(), ...createCloneGroup()];
    const trailingClones = [...createCloneGroup(), ...createCloneGroup()];

    templatesTrack.prepend(...leadingClones);
    templatesTrack.append(...trailingClones);

    const originalStart = originalCards[0].offsetLeft;
    const cycleWidth = trailingClones[0].offsetLeft - originalStart;
    templatesSlider.scrollLeft = originalStart + 120;

    let scrollEndTimer;
    const normalizeLoopPosition = () => {
      const scrollPosition = templatesSlider.scrollLeft;
      if (scrollPosition < originalStart) {
        templatesSlider.scrollLeft = scrollPosition + cycleWidth;
      } else if (scrollPosition >= originalStart + cycleWidth) {
        templatesSlider.scrollLeft = scrollPosition - cycleWidth;
      }
    };

    templatesSlider.addEventListener("scroll", () => {
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(normalizeLoopPosition, 100);
    });

    const scrollAmount = 350; // pixels to scroll per click
    templatesPrevBtn.addEventListener("click", () => {
      templatesSlider.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
    templatesNextBtn.addEventListener("click", () => {
      templatesSlider.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }


  // --- Cookies Banner & Promo Banner Logic ---
  const cookiesBanner = document.getElementById("cookiesBanner");
  const promoBanner = document.getElementById("promoBanner");
  
  const cookiesStateAccept = document.getElementById("cookiesStateAccept");
  const cookiesStateSettings = document.getElementById("cookiesStateSettings");
  
  const btnSettings = document.getElementById("btnSettings");
  const btnCancelSettings = document.getElementById("btnCancelSettings");
  const btnAcceptAll = document.getElementById("btnAcceptAll");
  const btnSavePreferences = document.getElementById("btnSavePreferences");
  const cookieCloseBtn = document.getElementById("cookieCloseBtn");
  const analyticsCookieToggle = document.getElementById("analyticsCookieToggle");
  const footerCookieSettings = document.getElementById("footer-cookie-settings");
  const footerLanguageMenu = document.querySelector(".figma-footer-language-menu");
  const footerLanguageButton = document.querySelector(".figma-footer-language");

  const languageCodes = {
    English: "en",
    Español: "es",
    Hindi: "hi",
    Deutsch: "de"
  };

  const landingPageTranslations = {
    Español: {
      Products: "Productos", Community: "Comunidad", Features: "Funciones", "Release Notes": "Notas de la versión", "Sign in": "Iniciar sesión", "Get started for free": "Comenzar gratis",
      "Website capture with one click": "Captura sitios web con un clic", New: "Nuevo", "Get Now": "Obtener ahora", "Build Better Designs": "Crea mejores diseños", "Convert Websites": "Convierte sitios web", "Explore Colors": "Explora colores", Icons: "Iconos", "Type Systems": "Sistemas tipográficos", "And More": "Y más",
      "Trusted by over 4 million job seekers and backed by Forbes as the best AI resume builder.": "Con la confianza de más de 4 millones de personas y el respaldo de Forbes.", "Join Community": "Únete a la comunidad", "8k+ Designers Joined": "Más de 8 mil diseñadores se unieron",
      "AI-powered UI design platform. Convert websites, generate design systems, and build modern interfaces faster.": "Plataforma de diseño UI con IA. Convierte sitios web, genera sistemas de diseño y crea interfaces modernas más rápido.", Tools: "Herramientas", Resources: "Recursos", Library: "Biblioteca", Company: "Empresa", "Color Generator": "Generador de colores", Typescale: "Escala tipográfica", "Token Export": "Exportar tokens", "HTML Export": "Exportar HTML", Documentation: "Documentación", Blog: "Blog", Tutorials: "Tutoriales", Logos: "Logotipos", About: "Acerca de", Careers: "Empleo", Contacts: "Contacto", "Cookie settings": "Configuración de cookies"
    },
    Hindi: {
      Products: "उत्पाद", Community: "समुदाय", Features: "सुविधाएं", "Release Notes": "रिलीज़ नोट्स", "Sign in": "साइन इन", "Get started for free": "मुफ्त में शुरू करें",
      "Website capture with one click": "एक क्लिक में वेबसाइट कैप्चर करें", New: "नया", "Get Now": "अभी प्राप्त करें", "Build Better Designs": "बेहतर डिज़ाइन बनाएं", "Convert Websites": "वेबसाइट बदलें", "Explore Colors": "रंग खोजें", Icons: "आइकन", "Type Systems": "टाइप सिस्टम", "And More": "और भी",
      "Trusted by over 4 million job seekers and backed by Forbes as the best AI resume builder.": "40 लाख से अधिक लोगों का भरोसा और Forbes द्वारा अनुशंसित।", "Join Community": "समुदाय से जुड़ें", "8k+ Designers Joined": "8 हजार से अधिक डिज़ाइनर जुड़े",
      "AI-powered UI design platform. Convert websites, generate design systems, and build modern interfaces faster.": "AI-संचालित UI डिज़ाइन प्लेटफ़ॉर्म। वेबसाइट बदलें, डिज़ाइन सिस्टम बनाएं और आधुनिक इंटरफ़ेस तेजी से तैयार करें।", Tools: "टूल्स", Resources: "संसाधन", Library: "लाइब्रेरी", Company: "कंपनी", "Color Generator": "कलर जनरेटर", Typescale: "टाइप स्केल", "Token Export": "टोकन एक्सपोर्ट", "HTML Export": "HTML एक्सपोर्ट", Documentation: "दस्तावेज़", Blog: "ब्लॉग", Tutorials: "ट्यूटोरियल", Logos: "लोगो", About: "हमारे बारे में", Careers: "करियर", Contacts: "संपर्क", "Cookie settings": "कुकी सेटिंग्स"
    },
    Deutsch: {
      Products: "Produkte", Community: "Community", Features: "Funktionen", "Release Notes": "Versionshinweise", "Sign in": "Anmelden", "Get started for free": "Kostenlos starten",
      "Website capture with one click": "Websites mit einem Klick erfassen", New: "Neu", "Get Now": "Jetzt holen", "Build Better Designs": "Bessere Designs erstellen", "Convert Websites": "Websites konvertieren", "Explore Colors": "Farben entdecken", Icons: "Symbole", "Type Systems": "Schriftsysteme", "And More": "Und mehr",
      "Trusted by over 4 million job seekers and backed by Forbes as the best AI resume builder.": "Mehr als 4 Millionen Menschen vertrauen uns, empfohlen von Forbes.", "Join Community": "Community beitreten", "8k+ Designers Joined": "Über 8 Tsd. Designer dabei",
      "AI-powered UI design platform. Convert websites, generate design systems, and build modern interfaces faster.": "KI-gestützte UI-Designplattform. Konvertieren Sie Websites, erstellen Sie Designsysteme und entwickeln Sie moderne Interfaces schneller.", Tools: "Werkzeuge", Resources: "Ressourcen", Library: "Bibliothek", Company: "Unternehmen", "Color Generator": "Farbgenerator", Typescale: "Typografieskala", "Token Export": "Tokens exportieren", "HTML Export": "HTML exportieren", Documentation: "Dokumentation", Blog: "Blog", Tutorials: "Tutorials", Logos: "Logos", About: "Über uns", Careers: "Karriere", Contacts: "Kontakt", "Cookie settings": "Cookie-Einstellungen"
    },
    Tamil: {
      Products: "தயாரிப்புகள்", Community: "சமூகம்", Features: "அம்சங்கள்", "Release Notes": "வெளியீட்டு குறிப்புகள்", "Sign in": "உள்நுழைய", "Get started for free": "இலவசமாக தொடங்குங்கள்",
      "Website capture with one click": "ஒரே கிளிக்கில் வலைத்தளத்தைப் பிடிக்கவும்", New: "புதியது", "Get Now": "இப்போது பெறுங்கள்", "Build Better Designs": "சிறந்த வடிவமைப்புகளை உருவாக்குங்கள்", "Convert Websites": "வலைத்தளங்களை மாற்றுங்கள்", "Explore Colors": "வண்ணங்களை ஆராயுங்கள்", Icons: "சின்னங்கள்", "Type Systems": "எழுத்துரு அமைப்புகள்", "And More": "மேலும் பல",
      "Trusted by over 4 million job seekers and backed by Forbes as the best AI resume builder.": "4 மில்லியனுக்கும் மேற்பட்டவர்களின் நம்பிக்கையைப் பெற்றது; Forbes பரிந்துரைத்தது.", "Join Community": "சமூகத்தில் சேருங்கள்", "8k+ Designers Joined": "8 ஆயிரத்திற்கும் மேற்பட்ட வடிவமைப்பாளர்கள் இணைந்துள்ளனர்",
      "AI-powered UI design platform. Convert websites, generate design systems, and build modern interfaces faster.": "AI-இயங்கும் UI வடிவமைப்பு தளம். வலைத்தளங்களை மாற்றி, வடிவமைப்பு அமைப்புகளை உருவாக்கி, நவீன இடைமுகங்களை வேகமாக உருவாக்குங்கள்.", Tools: "கருவிகள்", Resources: "வளங்கள்", Library: "நூலகம்", Company: "நிறுவனம்", "Color Generator": "வண்ண உருவாக்கி", Typescale: "எழுத்துரு அளவுகோல்", "Token Export": "டோக்கன்களை ஏற்றுமதி செய்க", "HTML Export": "HTML ஏற்றுமதி", Documentation: "ஆவணங்கள்", Blog: "வலைப்பதிவு", Tutorials: "பயிற்சிகள்", Logos: "லோகோக்கள்", About: "எங்களைப் பற்றி", Careers: "வேலைவாய்ப்புகள்", Contacts: "தொடர்பு", "Cookie settings": "குக்கீ அமைப்புகள்",
      "What you can do in Motvin": "Motvin இல் நீங்கள் செய்யக்கூடியவை", "Convert websites": "வலைத்தளங்களை மாற்றுங்கள்", "Capture any website and turn it into ediable design layers.": "எந்த வலைத்தளத்தையும் பிடித்து திருத்தக்கூடிய வடிவமைப்பு அடுக்குகளாக மாற்றுங்கள்.", "Explore creative tools": "படைப்புக் கருவிகளை ஆராயுங்கள்", "Colors, icons, templates, and resources all in one place.": "வண்ணங்கள், சின்னங்கள், டெம்ப்ளேட்கள் மற்றும் வளங்கள் அனைத்தும் ஒரே இடத்தில்.", "Explore all products": "அனைத்து தயாரிப்புகளையும் ஆராயுங்கள்", "Turn any webite into an editable design": "எந்த வலைத்தளத்தையும் திருத்தக்கூடிய வடிவமைப்பாக மாற்றுங்கள்", "Convert websites directly from your browser": "உங்கள் உலாவியிலிருந்து நேரடியாக வலைத்தளங்களை மாற்றுங்கள்", "Explore 200k+ editable icons": "2 லட்சத்திற்கும் மேற்பட்ட திருத்தக்கூடிய சின்னங்களை ஆராயுங்கள்", "Generate and customize typeface varients": "எழுத்துரு வகைகளை உருவாக்கி தனிப்பயனாக்குங்கள்",
      "Whatsapp Community": "WhatsApp சமூகம்", "Join our original designer community": "எங்கள் வடிவமைப்பாளர் சமூகத்தில் சேருங்கள்", "Connect and grow with fellow designers": "சக வடிவமைப்பாளர்களுடன் இணைந்து வளருங்கள்", "A growing space for designers and creators": "வடிவமைப்பாளர்கள் மற்றும் படைப்பாளர்களுக்கான வளர்ந்து வரும் இடம்", "2,000 Designers": "2,000 வடிவமைப்பாளர்கள்",
      "Features Demo": "அம்சங்களின் விளக்கம்", Turn: "மாற்றுங்கள்", any: "எந்த", live: "நேரடி", working: "செயல்படும்", websites: "வலைத்தளங்களை", into: "ஆக", an: "ஒரு", editable: "திருத்தக்கூடிய", "design.": "வடிவமைப்பாக.", "Fast.": "வேகமாக.", "Easy,": "எளிதாகவும்,", Powerful: "சக்திவாய்ந்ததாகவும்", "Explore Our Platform": "எங்கள் தளத்தை ஆராயுங்கள்", "Design without limits": "வரம்புகளில்லா வடிவமைப்பு", "Create stunning UI for websites, apps, and with total freedom.": "வலைத்தளங்கள் மற்றும் செயலிகளுக்கான அற்புதமான UI-ஐ முழு சுதந்திரத்துடன் உருவாக்குங்கள்.", "Explore design tools": "வடிவமைப்புக் கருவிகளை ஆராயுங்கள்", "Build Smarter with AI": "AI உடன் திறமையாக உருவாக்குங்கள்", "Generate beautiful color palettes and type scales with AI in seconds.": "AI மூலம் அழகான வண்ணத் தட்டுகளையும் எழுத்தளவுகளையும் நொடிகளில் உருவாக்குங்கள்.", "Explore build tools": "உருவாக்கக் கருவிகளை ஆராயுங்கள்",
      "Largest Icons Library": "மிகப்பெரிய சின்ன நூலகம்", "A world largest icon library": "உலகின் மிகப்பெரிய சின்ன நூலகம்", "102 Resources": "102 வளங்கள்", "212,300 Editable Icons": "212,300 திருத்தக்கூடிய சின்னங்கள்", "1282 Icon Categories": "1282 சின்ன வகைகள்", "How it works": "இது எப்படி செயல்படுகிறது", Explore: "ஆராயுங்கள்", "Get Started": "தொடங்குங்கள்", "Edit Everything": "அனைத்தையும் திருத்துங்கள்", "Generate Colors": "வண்ணங்களை உருவாக்குங்கள்", "Create Typescale": "எழுத்தளவை உருவாக்குங்கள்", "Convert Designs": "வடிவமைப்புகளை மாற்றுங்கள்", "Export Designs": "வடிவமைப்புகளை ஏற்றுமதி செய்க", "Design Faster": "வேகமாக வடிவமைக்கவும்",
      Templates: "டெம்ப்ளேட்கள்", "High-quality templates for designers.": "வடிவமைப்பாளர்களுக்கான உயர்தர டெம்ப்ளேட்கள்.", "Made by": "உருவாக்கியது", "on Motvin": "Motvin இல்", "Browse all templates": "அனைத்து டெம்ப்ளேட்களையும் பாருங்கள்", "1 of 6": "6 இல் 1", "Frequently & Questions": "அடிக்கடி கேட்கப்படும் கேள்விகள்", Need: "உதவி", "help?": "வேண்டுமா?", Find: "கண்டறியுங்கள்", what: "உங்களுக்கு", you: "தேவையானதை", "need.": "கண்டறியுங்கள்.", "What exactly is Motvin?": "Motvin என்றால் என்ன?", "Motvin is an advanced design tool that allows you to easily capture and customize live websites directly into your canvas.": "Motvin என்பது நேரடி வலைத்தளங்களை உங்கள் கேன்வாஸில் எளிதாகப் பிடித்து தனிப்பயனாக்க உதவும் மேம்பட்ட வடிவமைப்புக் கருவியாகும்.", "Why do I need to sign in with Google?": "நான் ஏன் Google மூலம் உள்நுழைய வேண்டும்?", "Signing in with Google ensures your projects are safely stored and synced across your devices effortlessly.": "Google மூலம் உள்நுழைவது உங்கள் திட்டங்கள் பாதுகாப்பாக சேமிக்கப்பட்டு சாதனங்கள் முழுவதும் ஒத்திசைக்கப்படுவதை உறுதிசெய்கிறது.", "Can I use Motvin without signing in?": "உள்நுழையாமல் Motvin-ஐ பயன்படுத்த முடியுமா?", "Currently, an account is required to use Motvin's core features so we can securely save your work.": "தற்போது, உங்கள் பணியை பாதுகாப்பாகச் சேமிக்க Motvin இன் முக்கிய அம்சங்களைப் பயன்படுத்த கணக்கு தேவை.", "Is Motvin free to use?": "Motvin பயன்படுத்த இலவசமா?", "We offer a free tier with core functionalities. Premium features are available through our subscription plans.": "முக்கிய அம்சங்களுடன் இலவசத் திட்டத்தை வழங்குகிறோம். மேம்பட்ட அம்சங்கள் சந்தா திட்டங்களில் கிடைக்கும்.", "What can the AI Color Palette Generator do?": "AI வண்ணத் தட்டு உருவாக்கி என்ன செய்யும்?", "It automatically extracts and generates stunning, accessible color palettes from any website or image you import.": "நீங்கள் இறக்குமதி செய்யும் எந்த வலைத்தளம் அல்லது படத்திலிருந்தும் அழகான, அணுகக்கூடிய வண்ணத் தட்டுகளை தானாக உருவாக்குகிறது.", "How does website-to-design conversion work?": "வலைத்தளத்தை வடிவமைப்பாக மாற்றுவது எப்படி செயல்படுகிறது?", "With just a single click, our engine parses the live HTML and CSS of a webpage and converts it into fully editable design layers.": "ஒரே கிளிக்கில், எங்கள் இயந்திரம் வலைப்பக்கத்தின் நேரடி HTML மற்றும் CSS-ஐ பகுத்து முழுமையாகத் திருத்தக்கூடிய வடிவமைப்பு அடுக்குகளாக மாற்றுகிறது."
    }
  };

  Object.assign(landingPageTranslations.Español, {
    "What you can do in Motvin": "Lo que puedes hacer en Motvin", "Convert websites": "Convertir sitios web", "Explore creative tools": "Explora herramientas creativas", "Explore all products": "Explora todos los productos", "Whatsapp Community": "Comunidad de WhatsApp", "Features Demo": "Demostración de funciones", Turn: "Convierte", any: "cualquier", live: "sitio", working: "web", websites: "funcional", into: "en", an: "un", editable: "diseño editable", "design.": "de diseño.", "Fast.": "Rápido.", "Easy,": "Fácil,", Powerful: "Potente", "Explore Our Platform": "Explora nuestra plataforma", "Design without limits": "Diseña sin límites", "Explore design tools": "Explora herramientas de diseño", "Build Smarter with AI": "Crea mejor con IA", "Explore build tools": "Explora herramientas de creación", "Largest Icons Library": "La biblioteca de iconos más grande", "A world largest icon library": "La biblioteca de iconos más grande del mundo", "102 Resources": "102 recursos", "212,300 Editable Icons": "212.300 iconos editables", "1282 Icon Categories": "1282 categorías de iconos", "How it works": "Cómo funciona", Explore: "Explora", "Get Started": "Comenzar", "Edit Everything": "Edita todo", "Generate Colors": "Genera colores", "Create Typescale": "Crea una escala tipográfica", "Convert Designs": "Convierte diseños", "Export Designs": "Exporta diseños", "Design Faster": "Diseña más rápido", Templates: "Plantillas", "High-quality templates for designers.": "Plantillas de alta calidad para diseñadores.", "Browse all templates": "Ver todas las plantillas", "Frequently & Questions": "Preguntas frecuentes", Need: "¿Necesitas", "help?": "ayuda?", Find: "Encuentra", what: "lo que", you: "necesitas.", "need.": "necesitas.", "What exactly is Motvin?": "¿Qué es exactamente Motvin?", "Why do I need to sign in with Google?": "¿Por qué debo iniciar sesión con Google?", "Can I use Motvin without signing in?": "¿Puedo usar Motvin sin iniciar sesión?", "Is Motvin free to use?": "¿Motvin es gratuito?", "What can the AI Color Palette Generator do?": "¿Qué puede hacer el generador de paletas de IA?", "How does website-to-design conversion work?": "¿Cómo funciona la conversión de sitios web a diseños?"
  });

  Object.assign(landingPageTranslations.Hindi, {
    "What you can do in Motvin": "Ce que vous pouvez faire avec Motvin", "Convert websites": "Convertir des sites web", "Explore creative tools": "Explorer les outils créatifs", "Explore all products": "Explorer tous les produits", "Whatsapp Community": "Communauté WhatsApp", "Features Demo": "Démo des fonctionnalités", Turn: "Transformez", any: "n'importe quel", live: "site", working: "web", websites: "fonctionnel", into: "en", an: "un", editable: "design modifiable", "design.": "modifiable.", "Fast.": "Rapide.", "Easy,": "Simple,", Powerful: "Puissant", "Explore Our Platform": "Explorer notre plateforme", "Design without limits": "Concevez sans limites", "Explore design tools": "Explorer les outils de design", "Build Smarter with AI": "Créez mieux avec l'IA", "Explore build tools": "Explorer les outils de création", "Largest Icons Library": "La plus grande bibliothèque d'icônes", "A world largest icon library": "La plus grande bibliothèque d'icônes au monde", "102 Resources": "102 ressources", "212,300 Editable Icons": "212 300 icônes modifiables", "1282 Icon Categories": "1282 catégories d'icônes", "How it works": "Comment ça marche", Explore: "Explorer", "Get Started": "Commencer", "Edit Everything": "Tout modifier", "Generate Colors": "Générer des couleurs", "Create Typescale": "Créer une échelle typographique", "Convert Designs": "Convertir les designs", "Export Designs": "Exporter les designs", "Design Faster": "Concevoir plus vite", Templates: "Modèles", "High-quality templates for designers.": "Des modèles de qualité pour les designers.", "Browse all templates": "Voir tous les modèles", "Frequently & Questions": "Questions fréquentes", Need: "Besoin", "help?": "d'aide ?", Find: "Trouvez", what: "ce dont", you: "vous avez besoin.", "need.": "vous avez besoin.", "What exactly is Motvin?": "Qu'est-ce que Motvin ?", "Why do I need to sign in with Google?": "Pourquoi dois-je me connecter avec Google ?", "Can I use Motvin without signing in?": "Puis-je utiliser Motvin sans me connecter ?", "Is Motvin free to use?": "Motvin est-il gratuit ?", "What can the AI Color Palette Generator do?": "Que peut faire le générateur de palettes IA ?", "How does website-to-design conversion work?": "Comment fonctionne la conversion d'un site web en design ?"
  });

  Object.assign(landingPageTranslations.Hindi, {
    "What you can do in Motvin": "Motvin में आप क्या कर सकते हैं", "Convert websites": "वेबसाइट बदलें", "Explore creative tools": "रचनात्मक टूल्स खोजें", "Explore all products": "सभी उत्पाद खोजें", "Whatsapp Community": "WhatsApp समुदाय", "Features Demo": "सुविधाओं का डेमो", Turn: "बदलें", any: "किसी भी", live: "लाइव", working: "काम करने वाली", websites: "वेबसाइट को", into: "में", an: "एक", editable: "संपादन योग्य", "design.": "डिज़ाइन में।", "Fast.": "तेज़।", "Easy,": "आसान,", Powerful: "शक्तिशाली", "Explore Our Platform": "हमारा प्लेटफ़ॉर्म खोजें", "Design without limits": "बिना सीमाओं के डिज़ाइन करें", "Explore design tools": "डिज़ाइन टूल्स खोजें", "Build Smarter with AI": "AI के साथ बेहतर बनाएं", "Explore build tools": "बिल्ड टूल्स खोजें", "Largest Icons Library": "सबसे बड़ी आइकन लाइब्रेरी", "A world largest icon library": "दुनिया की सबसे बड़ी आइकन लाइब्रेरी", "102 Resources": "102 संसाधन", "212,300 Editable Icons": "2,12,300 संपादन योग्य आइकन", "1282 Icon Categories": "1282 आइकन श्रेणियां", "How it works": "यह कैसे काम करता है", Explore: "खोजें", "Get Started": "शुरू करें", "Edit Everything": "सब कुछ संपादित करें", "Generate Colors": "रंग बनाएं", "Create Typescale": "टाइप स्केल बनाएं", "Convert Designs": "डिज़ाइन बदलें", "Export Designs": "डिज़ाइन एक्सपोर्ट करें", "Design Faster": "तेज़ी से डिज़ाइन करें", Templates: "टेम्पलेट्स", "High-quality templates for designers.": "डिज़ाइनरों के लिए उच्च-गुणवत्ता वाले टेम्पलेट्स।", "Browse all templates": "सभी टेम्पलेट्स देखें", "Frequently & Questions": "अक्सर पूछे जाने वाले प्रश्न", Need: "मदद", "help?": "चाहिए?", Find: "ढूंढें", what: "जो", you: "आपको चाहिए।", "need.": "आपको चाहिए।", "What exactly is Motvin?": "Motvin वास्तव में क्या है?", "Why do I need to sign in with Google?": "मुझे Google से साइन इन करने की जरूरत क्यों है?", "Can I use Motvin without signing in?": "क्या मैं बिना साइन इन किए Motvin का उपयोग कर सकता हूं?", "Is Motvin free to use?": "क्या Motvin का उपयोग मुफ्त है?", "What can the AI Color Palette Generator do?": "AI कलर पैलेट जनरेटर क्या कर सकता है?", "How does website-to-design conversion work?": "वेबसाइट से डिज़ाइन में रूपांतरण कैसे काम करता है?"
  });

  Object.assign(landingPageTranslations.Deutsch, {
    "What you can do in Motvin": "Was Sie mit Motvin machen können", "Convert websites": "Websites konvertieren", "Explore creative tools": "Kreative Werkzeuge entdecken", "Explore all products": "Alle Produkte entdecken", "Whatsapp Community": "WhatsApp-Community", "Features Demo": "Funktionsdemo", Turn: "Verwandeln", any: "Sie", live: "jede", working: "funktionierende", websites: "Website", into: "in", an: "ein", editable: "bearbeitbares", "design.": "Design.", "Fast.": "Schnell.", "Easy,": "Einfach,", Powerful: "Leistungsstark", "Explore Our Platform": "Unsere Plattform entdecken", "Design without limits": "Design ohne Grenzen", "Explore design tools": "Designwerkzeuge entdecken", "Build Smarter with AI": "Intelligenter mit KI entwickeln", "Explore build tools": "Entwicklungswerkzeuge entdecken", "Largest Icons Library": "Größte Icon-Bibliothek", "A world largest icon library": "Die größte Icon-Bibliothek der Welt", "102 Resources": "102 Ressourcen", "212,300 Editable Icons": "212.300 bearbeitbare Icons", "1282 Icon Categories": "1282 Icon-Kategorien", "How it works": "So funktioniert es", Explore: "Entdecken", "Get Started": "Loslegen", "Edit Everything": "Alles bearbeiten", "Generate Colors": "Farben generieren", "Create Typescale": "Typografieskala erstellen", "Convert Designs": "Designs konvertieren", "Export Designs": "Designs exportieren", "Design Faster": "Schneller gestalten", Templates: "Vorlagen", "High-quality templates for designers.": "Hochwertige Vorlagen für Designer.", "Browse all templates": "Alle Vorlagen ansehen", "Frequently & Questions": "Häufige Fragen", Need: "Brauchen", "help?": "Sie Hilfe?", Find: "Finden", what: "Sie, was", you: "Sie brauchen.", "need.": "Sie brauchen.", "What exactly is Motvin?": "Was genau ist Motvin?", "Why do I need to sign in with Google?": "Warum muss ich mich mit Google anmelden?", "Can I use Motvin without signing in?": "Kann ich Motvin ohne Anmeldung nutzen?", "Is Motvin free to use?": "Ist Motvin kostenlos?", "What can the AI Color Palette Generator do?": "Was kann der KI-Farbpaletten-Generator?", "How does website-to-design conversion work?": "Wie funktioniert die Website-zu-Design-Konvertierung?"
  });

  function applyLandingPageLanguage(language) {
    const translations = landingPageTranslations[language] || {};

    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (textNodes.nextNode()) {
      const textNode = textNodes.currentNode;
      const parent = textNode.parentElement;
      const sourceText = textNode.languageSource || textNode.textContent.trim();

      if (!sourceText || !parent || parent.closest("script, style, .figma-footer-language-menu")) continue;

      textNode.languageSource = sourceText;
      const leadingWhitespace = textNode.textContent.match(/^\s*/)[0];
      const trailingWhitespace = textNode.textContent.match(/\s*$/)[0];
      textNode.textContent = `${leadingWhitespace}${translations[sourceText] || sourceText}${trailingWhitespace}`;
    }

    document.documentElement.lang = languageCodes[language] || "en";
    localStorage.setItem("motvin_language", language);
  }

  if (footerCookieSettings && cookiesBanner && cookiesStateAccept && cookiesStateSettings) {
    footerCookieSettings.addEventListener("click", () => {
      cookiesBanner.style.display = "block";
      cookiesStateAccept.style.display = "none";
      cookiesStateSettings.style.display = "block";
    });
  }

  if (footerLanguageMenu && footerLanguageButton) {
    const footerLanguageLabel = footerLanguageButton.querySelector("span");
    const storedLanguage = localStorage.getItem("motvin_language");
    const savedLanguage = languageCodes[storedLanguage] ? storedLanguage : "English";
    footerLanguageLabel.textContent = savedLanguage;
    applyLandingPageLanguage(savedLanguage);

    footerLanguageButton.addEventListener("click", () => {
      const isOpen = footerLanguageMenu.classList.toggle("is-open");
      footerLanguageButton.setAttribute("aria-expanded", String(isOpen));
    });

    footerLanguageMenu.querySelectorAll("[data-language]").forEach((option) => {
      option.addEventListener("click", () => {
        footerLanguageLabel.textContent = option.dataset.language;
        applyLandingPageLanguage(option.dataset.language);
        footerLanguageMenu.classList.remove("is-open");
        footerLanguageButton.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (event) => {
      if (!footerLanguageMenu.contains(event.target)) {
        footerLanguageMenu.classList.remove("is-open");
        footerLanguageButton.setAttribute("aria-expanded", "false");
      }
    });
  }

  function showPromoBanner() {
    if (promoBanner) {
      promoBanner.style.display = 'flex';
    }
  }

  function initializeGoogleAnalytics() {
    if (window.gtag) return; // Prevent duplicate injection
    
    // Dynamically inject the Google Analytics script
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-4DTKXD35BH";
    document.head.appendChild(script);

    // Initialize dataLayer and gtag
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    window.gtag = gtag;
    
    gtag('js', new Date());
    gtag('config', 'G-4DTKXD35BH');
    
    console.log("Analytics cookies accepted. Google Analytics G-4DTKXD35BH initialized.");
  }

  function completeCookieFlow(preference) {
    localStorage.setItem("motvin_cookie_preference", JSON.stringify(preference));
    if (cookiesBanner) {
      cookiesBanner.style.display = "none";
    }
    showPromoBanner();
    
    if (preference.analytics) {
      initializeGoogleAnalytics();
    }
  }

  if (cookiesBanner) {
    const savedPref = localStorage.getItem("motvin_cookie_preference");
    
    if (savedPref) {
      // Flow already completed previously
      showPromoBanner();
      
      try {
        const parsedPref = JSON.parse(savedPref);
        if (parsedPref.analytics) {
          initializeGoogleAnalytics();
        }
      } catch (e) {
        console.error("Error parsing cookie preference", e);
      }
    } else {
      // Show cookies banner
      cookiesBanner.style.display = "block";
    }

    // Toggle States
    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        cookiesStateAccept.style.display = "none";
        cookiesStateSettings.style.display = "block";
      });
    }

    if (btnCancelSettings) {
      btnCancelSettings.addEventListener("click", () => {
        cookiesStateSettings.style.display = "none";
        cookiesStateAccept.style.display = "block";
      });
    }

    // Actions
    if (btnAcceptAll) {
      btnAcceptAll.addEventListener("click", () => {
        completeCookieFlow({ essential: true, analytics: true });
      });
    }

    if (btnSavePreferences) {
      btnSavePreferences.addEventListener("click", () => {
        const analyticsEnabled = analyticsCookieToggle ? analyticsCookieToggle.checked : false;
        completeCookieFlow({ essential: true, analytics: analyticsEnabled });
      });
    }

    if (cookieCloseBtn) {
      cookieCloseBtn.addEventListener("click", () => {
        // If they close it without saving, we default to essential only.
        completeCookieFlow({ essential: true, analytics: false });
      });
    }
  }

  // --- Hero Section Animation ---
  let heroScrollInitialized = false;
  const initializeHeroScroll = () => {
    if (heroScrollInitialized) return;
    if (!(window.innerWidth > 1300 && typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined" && typeof Draggable !== "undefined")) return;

    heroScrollInitialized = true;
    gsap.registerPlugin(ScrollTrigger, Draggable);

    const heroWidgets = [".color-widget", ".typescale-widget"];

    // Create a timeline perfectly synchronized with the scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".hero-section",
        start: "top 65px", 
        end: "+=250px", // Exactly matches the height shrink below
        pin: true, 
        pinSpacing: false, // Prevents GSAP from adding extra invisible height to the bottom of the page!
        scrub: 3, 
      }
    });

    // 1. Fade hero text as the section transitions out on scroll.
    tl.to(".hero-badge, .hero-title-interactive, .hero-subtitle, .hero-cta", {
      opacity: 0,
      duration: 0.5,
      ease: "sine.inOut"
    }, 0)

    // 2. Visually crop the hero section's bottom edge to mathematically match the scroll progress
    // We use clipPath instead of height so the gradient doesn't recalculate and break on refresh!
    // Since pinSpacing is false, the next section naturally scrolls up to meet this shrinking edge perfectly.
    .fromTo(".hero-section", 
      { clipPath: "inset(0px 0px 0px 0px)" },
      { clipPath: "inset(0px 0px 250px 0px)", duration: 0.5, ease: "sine.inOut" }, 
      0.1
    )
    
    // 3. Demo scales down and moves upward visually
    .fromTo(".demo-window", 
      { scale: 1, y: 0 },
      { scale: 0.8, y: -250, duration: 0.5, ease: "sine.inOut" }, 
      0.1
    )
    
    // 4. Widgets float up from below and scale down to normal size
    .fromTo(heroWidgets,
      { scale: 1.1, y: 150 },
      { scale: 1, y: 0, duration: 0.5, ease: "sine.inOut" }, 
      0.1
    )
    
    // 5. Unblur and fade in the widgets quickly
    .fromTo(heroWidgets,
      { opacity: 0, filter: "blur(4px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.2, ease: "none" },
      0.1
    );

    // Make the Widgets Draggable
    Draggable.create([".color-widget", ".typescale-widget"], {
      type: "left,top", // Use layout properties so it doesn't conflict with ScrollTrigger's transform animations
      bounds: ".hero-section", // Keep it contained inside the hero section
      edgeResistance: 0.65 // Gives it a nice bouncy resistance when hitting the edges
    });
  };

  initializeHeroScroll();

  if (typeof gsap !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.timeline()
      .fromTo(".hero-badge, .hero-title-row, .hero-subtitle, .hero-cta",
        { y: 32 },
        { y: 0, duration: 0.7, ease: "power3.out", stagger: 0.1, clearProps: "transform" }
      )
      .fromTo(".hero-demo",
        { autoAlpha: 0, y: 56, scale: 0.97 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out", clearProps: "transform" },
        "-=0.35"
      );
  }

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    item.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      
      // Close all items
      faqItems.forEach(faq => faq.classList.remove("active"));
      
      // If it wasn't active before, open it
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });
  // --- How it Works Auto Scroll ---
  const scrollContainer = document.querySelector('.howitwork-right-col');
  if (scrollContainer) {
    // Clone the content to make it seamlessly loop
    const content = scrollContainer.innerHTML;
    scrollContainer.innerHTML = content + content;
    
    let scrollAmount = 0;
    let isPaused = false;
    
    // Define the scroll speed (pixels per frame)
    const scrollSpeed = 0.2;

    function scrollLoop() {
      if (!isPaused) {
        scrollAmount += scrollSpeed;
        // If we've scrolled exactly halfway (the length of the original content), reset to 0
        if (scrollAmount >= scrollContainer.scrollHeight / 2) {
          scrollAmount = 0;
        }
        scrollContainer.scrollTop = scrollAmount;
      }
      requestAnimationFrame(scrollLoop);
    }

    // Start the loop
    requestAnimationFrame(scrollLoop);

    // Pause on hover
    scrollContainer.addEventListener('mouseenter', () => {
      isPaused = true;
    });

    // Resume on mouse leave
    scrollContainer.addEventListener('mouseleave', () => {
      isPaused = false;
      // Ensure scrollAmount is synchronized with any manual scrolling the user did while paused
      scrollAmount = scrollContainer.scrollTop;
      if (scrollAmount >= scrollContainer.scrollHeight / 2) {
        scrollAmount -= scrollContainer.scrollHeight / 2;
        scrollContainer.scrollTop = scrollAmount;
      }
    });
  } // <-- Added missing closing brace for if (scrollContainer) {

  // --- Trusted Partners Auto Scroll (Horizontal) ---
  const partnersScrollContainer = document.querySelector('.trusted-partners-scroll');
  const partnersTrack = document.querySelector('.trusted-partners-track');
  
  if (partnersScrollContainer && partnersTrack) {
    // Get the exact loop distance by measuring scrollWidth and adding the gap
    const gap = parseInt(window.getComputedStyle(partnersTrack).gap) || 0;
    const loopDistance = partnersTrack.scrollWidth + gap;

    // Clone the content to make it seamlessly loop
    const partnersContent = partnersTrack.innerHTML;
    partnersTrack.innerHTML = partnersContent + partnersContent;
    
    let partnersScrollAmount = 0;
    let partnersIsPaused = false;
    
    // Define the scroll speed (pixels per frame)
    const partnersScrollSpeed = 1.0;

    function partnersScrollLoop() {
      if (!partnersIsPaused) {
        partnersScrollAmount += partnersScrollSpeed;
        
        // If we've scrolled exactly the distance of one original set, reset seamlessly
        if (partnersScrollAmount >= loopDistance) {
          partnersScrollAmount -= loopDistance;
        }
        partnersScrollContainer.scrollLeft = partnersScrollAmount;
      }
      requestAnimationFrame(partnersScrollLoop);
    }

    // Start the loop
    requestAnimationFrame(partnersScrollLoop);

    // Pause on hover
    partnersScrollContainer.addEventListener('mouseenter', () => {
      partnersIsPaused = true;
    });

    // Resume on mouse leave
    partnersScrollContainer.addEventListener('mouseleave', () => {
      partnersIsPaused = false;
    });
  }

  // --- Reusable Word Animation ---
  function applyWordAnimation(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container || typeof gsap === "undefined") return;

    const words = container.querySelectorAll('.animated-word');
    if (words.length === 0) return;

    const tl = gsap.timeline({ paused: true });

    words.forEach((word, i) => {
      const stepTime = 0.12; // Very fast step time per word
      const halfStep = stepTime / 2;
      
      // Step 1: Instantly turn light purple and pop the word up slightly
      tl.set(word, { color: "#9587FB" }, i * stepTime)
        .to(word, { y: -6, scale: 1.05, duration: halfStep, ease: "power1.out" }, i * stepTime)
        
        // Step 2: Instantly turn dark purple halfway through its duration, and start bouncy drop
        .set(word, { color: "#5C4AE4" }, (i * stepTime) + halfStep)
        .to(word, { y: 0, scale: 1, duration: 0.2, ease: "back.out(2.5)" }, (i * stepTime) + halfStep)
        
        // Step 3: Instantly turn back to original exactly when the next word starts
        .set(word, { clearProps: "color" }, (i * stepTime) + stepTime);
    });

    // Trigger precisely when it becomes visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tl.play(); // Play the timeline
          observer.disconnect(); // Ensure it only plays once on scroll
        }
      });
    }, {
      rootMargin: "0px",
      threshold: 0.01 // Trigger immediately when entering
    });
    observer.observe(container);
    
    // Also replay the animation whenever the user hovers over the title
    container.addEventListener('mouseenter', () => {
      // Only restart if the animation isn't already currently playing
      if (!tl.isActive()) {
        tl.restart();
      }
    });
  }

  // Apply to all requested sections
  applyWordAnimation('.demo-title');
  applyWordAnimation('.howitwork-title');
  applyWordAnimation('.faq-subtitle');
  applyWordAnimation('.faq-title');

  // --- Section Scroll Reveals ---
  if (typeof gsap !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealSections = [
      { selector: '.demo-section', items: '.demo-title, .demo-description, .demo-body-container, .demo-features-grid' },
      { selector: '.icons-library-section', items: '.il-heading, .il-content, .il-text-content' },
      { selector: '.howitwork-redesign', items: '.howitwork-redesign-intro > *, .howitwork-redesign-cta > *' },
      { selector: '.templates-section', items: '.templates-header, .templates-slider-container' },
      { selector: '.faq-section', items: '.faq-header, .faq-list' },
      { selector: '.explore-section', items: '.explore-section-container > *' },
      { selector: '.footer-section', items: '.figma-footer-content > *' }
    ];

    revealSections.forEach(({ selector, items }) => {
      const section = document.querySelector(selector);
      if (!section) return;

      const targets = section.querySelectorAll(items);
      if (!targets.length) return;

      gsap.fromTo(targets,
        { autoAlpha: 0, y: 48 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: section,
            start: 'top 78%',
            once: true
          }
        }
      );
    });
  }

  // --- Authentication Integration ---
  const signinBtn = document.getElementById('auth-signin-btn');
  const signupBtn = document.getElementById('auth-signup-btn');
  const exploreSignupBtn = document.getElementById('explore-signup-btn');
  const dashboardBtn = document.getElementById('auth-dashboard-btn');
  const howitworkSignupBtn = document.getElementById('howitwork-signup-btn');

  if (window.FirebaseAuthService && signinBtn && signupBtn && dashboardBtn) {
    signinBtn.addEventListener('click', (e) => { e.preventDefault(); window.AuthModal.open('login'); });
    signupBtn.addEventListener('click', (e) => { e.preventDefault(); window.AuthModal.open('register'); });
    if (exploreSignupBtn) exploreSignupBtn.addEventListener('click', (e) => { e.preventDefault(); window.AuthModal.open('register'); });
    howitworkSignupBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      signupBtn.click();
    });

    window.FirebaseAuthService.onChange((user) => {
      if (user && !user.isAnonymous) {
        signinBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        if (exploreSignupBtn) exploreSignupBtn.style.display = 'none';
        dashboardBtn.style.display = '';
        if (window.AuthModal) window.AuthModal.close();
      } else {
        signinBtn.style.display = '';
        signupBtn.style.display = '';
        if (exploreSignupBtn) exploreSignupBtn.style.display = '';
        dashboardBtn.style.display = 'none';
      }
    });
  }
});


document.addEventListener('DOMContentLoaded', () => {
  const interactiveWords = document.querySelectorAll('.interactive-word-wrapper');
  const floatingStates = document.querySelectorAll('.hero-floating-state');
  let cycleInterval;
  let currentIndex = 0;
  let isHovered = false;

  function activateState(stateName) {
    const targetWord = document.querySelector(`.interactive-word-wrapper[data-state="${stateName}"]`);
    if (targetWord && targetWord.classList.contains('active')) return; // Prevent re-triggering

    // Reset all
    interactiveWords.forEach(w => w.classList.remove('active'));
    floatingStates.forEach(s => s.classList.remove('active'));

    // Activate specific
    const word = targetWord;
    const floating = document.getElementById(`floating-${stateName}`);

    if (word) word.classList.add('active');
    if (floating) {
      floating.classList.add('active');
      gsap.fromTo(floating.querySelectorAll('.floating-item'), 
        { y: 30, scale: 0.8, opacity: 0 }, 
        { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)", stagger: 0.05, overwrite: "auto" }
      );
    }
  }

  // Handle Hover
  interactiveWords.forEach((word, index) => {
    word.addEventListener('mouseenter', () => {
      isHovered = true;
      clearInterval(cycleInterval);
      const stateName = word.getAttribute('data-state');
      activateState(stateName);
      currentIndex = index;
    });

    word.addEventListener('mouseleave', () => {
      isHovered = false;
      startAutoCycle();
    });
  });

  function startAutoCycle() {
    clearInterval(cycleInterval);
    cycleInterval = setInterval(() => {
      if (!isHovered && interactiveWords.length > 0) {
        currentIndex = (currentIndex + 1) % interactiveWords.length;
        const stateName = interactiveWords[currentIndex].getAttribute('data-state');
        activateState(stateName);
      }
    }, 3000);
  }

  // Init
  if (interactiveWords.length > 0) {
    const startState = 'icons';
    currentIndex = Array.from(interactiveWords).findIndex(w => w.getAttribute('data-state') === startState);
    if (currentIndex === -1) currentIndex = 0;
    activateState(startState);
    startAutoCycle();
  }

  // --- Largest Icons Library Scroll Logic ---
  const iconsLibrarySection = document.getElementById('icons-library-section');
  const stickyHeader = document.querySelector('.sticky-header');
  const badge = document.querySelector('.il-badge');
  const ilContainer = document.querySelector('.il-container');
  const ilStickyWrapper = document.querySelector('.il-sticky-wrapper');
  const floatingLogos = iconsLibrarySection ? iconsLibrarySection.querySelector('.il-floating-logos') : null;
  
  if (iconsLibrarySection) {
    const titles = iconsLibrarySection.querySelectorAll('.il-title');
    
    window.addEventListener('scroll', () => {
      const rect = iconsLibrarySection.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Trigger throw-in animation when reaching the section
      if (floatingLogos && rect.top <= windowHeight * 0.7) {
        floatingLogos.classList.add('thrown');
      }
      
      // Calculate progress between 0 and 1
      const scrollDistance = rect.height - windowHeight;
      let progress = -rect.top / scrollDistance;
      
      // Hide sticky header, badge, and borders when scrolling through the section
      const isStickyActive = progress > 0 && progress < 1;
      if (stickyHeader) {
        if (isStickyActive) {
          stickyHeader.classList.add('hidden');
        } else {
          stickyHeader.classList.remove('hidden');
        }
      }
      if (badge) {
        if (isStickyActive) {
          badge.classList.add('hidden');
        } else {
          badge.classList.remove('hidden');
        }
      }
      if (ilContainer) {
        if (isStickyActive) {
          ilContainer.classList.add('no-border');
        } else {
          ilContainer.classList.remove('no-border');
        }
      }
      if (ilStickyWrapper) {
        if (isStickyActive) {
          ilStickyWrapper.classList.add('no-border');
        } else {
          ilStickyWrapper.classList.remove('no-border');
        }
      }      
      progress = Math.max(0, Math.min(1, progress));
      
      // Thresholds for the 3 states
      const phase1 = 0.33;
      const phase2 = 0.66;
      
      // Reset classes
      titles.forEach(t => {
        t.classList.remove('active', 'exited');
      });
      
      if (progress >= 0.05) titles[0].classList.add('active');
      if (progress >= phase1) titles[1].classList.add('active');
      if (progress >= phase2) titles[2].classList.add('active');
    });
    
    // Trigger scroll event once on load to set initial state
    window.dispatchEvent(new Event('scroll'));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const MAIN_PROMO_KEY = "motvin_main_promo_hidden_until";
  const promoBanner = document.getElementById("promoBanner");
  const promoCloseBtn = document.getElementById("promoBannerCloseBtn");
  
  if (promoBanner) {
    const hiddenUntil = localStorage.getItem(MAIN_PROMO_KEY);
    if (hiddenUntil && Date.now() < parseInt(hiddenUntil, 10)) {
      promoBanner.style.display = "none";
    } else if (promoCloseBtn) {
      promoCloseBtn.addEventListener("click", () => {
        promoBanner.style.display = "none";
        // 4 hours in milliseconds: 4 * 60 * 60 * 1000 = 14400000
        localStorage.setItem(MAIN_PROMO_KEY, (Date.now() + 14400000).toString());
      });
    }
  }
});
