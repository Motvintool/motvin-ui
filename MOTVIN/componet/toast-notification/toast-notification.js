class ToastNotification extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Define SVG properties inline to eliminate external dependencies
        this.svgSuccess = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.6666 5L7.49992 14.1667L3.33325 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        this.svgWarning = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.66667V10M10 13.3333H10.0083M18.3333 10C18.3333 14.6024 14.6024 18.3333 10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 10C1.66667 5.39763 5.39763 1.66667 10 1.66667C14.6024 1.66667 18.3333 5.39763 18.3333 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        this.svgFailed = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 7.5L7.5 12.5M7.5 7.5L12.5 12.5M18.3333 10C18.3333 14.6024 14.6024 18.3333 10 18.3333C5.39763 18.3333 1.66667 14.6024 1.66667 10C1.66667 5.39763 5.39763 1.66667 10 1.66667C14.6024 1.66667 18.3333 5.39763 18.3333 10Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        this.svgClose = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    right: 24px;
                    top: 24px;
                    z-index: 2147483647;
                    isolation: isolate;
                    display: block;
                    width: 308px;
                    max-width: calc(100vw - 32px);
                    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    visibility: hidden;
                    opacity: 0;
                    transform: translateY(-20px);
                    pointer-events: none;
                    will-change: opacity, transform;
                    transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s;
                }

                :host(.toast-active) {
                    visibility: visible;
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }

                .toast-container {
                    background-color: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
                    backdrop-filter: blur(8px);
                }

                .toast-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px 12px 20px;
                    border-bottom: 1px solid #f3f4f6;
                }

                .toast-header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .icon-box {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .icon-box svg {
                    width: 16px;
                    height: 16px;
                }

                /* Success State */
                :host([state="success"]) .icon-box, 
                :host(:not([state])) .icon-box {
                    background-color: rgba(70, 71, 211, 0.12);
                }
                :host([state="success"]) .icon-box svg path,
                :host(:not([state])) .icon-box svg path {
                    stroke: #4647d3;
                }

                /* Warning State */
                :host([state="warning"]) .icon-box {
                    background-color: rgba(214, 131, 42, 0.12);
                }
                :host([state="warning"]) .icon-box svg path {
                    stroke: #d6832a;
                }

                /* Failed/Error State */
                :host([state="failed"]) .icon-box,
                :host([state="error"]) .icon-box {
                    background-color: rgba(239, 68, 68, 0.12);
                }
                :host([state="failed"]) .icon-box svg path,
                :host([state="error"]) .icon-box svg path {
                    stroke: #ef4444;
                }

                .title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #111827;
                    margin: 0;
                    line-height: normal;
                }

                .message {
                    padding: 12px 20px 16px 20px;
                    font-size: 13px;
                    font-weight: 400;
                    color: #4b5563;
                    margin: 0;
                    line-height: 1.5;
                }

                .close-btn {
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    color: #a1a1aa;
                    transition: color 0.15s ease, background-color 0.15s ease;
                }
                
                .close-btn:hover {
                    color: #111827;
                    background-color: #f1f5f9;
                }
                .close-btn svg path {
                    stroke: currentColor;
                }

                .progress-bar {
                    position: absolute;
                    bottom: 0;
                    left: 2px;
                    height: 3px;
                    width: calc(100% - 4px);
                    border-radius: 3px;
                    transform-origin: left;
                    animation-name: progress;
                    animation-timing-function: linear;
                    animation-fill-mode: forwards;
                }

                @keyframes progress {
                    0% { transform: scaleX(1); }
                    100% { transform: scaleX(0); }
                }

                :host([state="success"]) .progress-bar,
                :host(:not([state])) .progress-bar {
                    background-image: linear-gradient(179.812deg, rgb(70, 71, 211) 6.09%, rgb(147, 150, 255) 93.91%);
                }

                :host([state="warning"]) .progress-bar {
                     background-image: linear-gradient(179.812deg, rgb(214, 131, 42) 6.09%, rgb(252, 193, 128) 93.91%);
                }

                :host([state="failed"]) .progress-bar,
                :host([state="error"]) .progress-bar {
                     background-image: linear-gradient(179.812deg, rgb(218, 41, 44) 6.09%, rgb(255, 124, 126) 93.91%);
                }
            
                /* ─── Dark theme overrides ─── */
                :host-context([data-theme="dark"]) .toast-container {
                    background-color: #1e1e1e;
                    border-color: #343434;
                    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25);
                }
                :host-context([data-theme="dark"]) .toast-header {
                    border-bottom-color: rgba(255, 255, 255, 0.08);
                }
                :host-context([data-theme="dark"]) .title {
                    color: #ffffff;
                }
                :host-context([data-theme="dark"]) .message {
                    color: #a1a1aa;
                }
                :host-context([data-theme="dark"]) .close-btn:hover {
                    color: #ffffff;
                    background-color: rgba(255, 255, 255, 0.1);
                }
            </style>
            <div class="toast-container">
                <div class="toast-header">
                    <div class="toast-header-title">
                        <div class="icon-box" id="iconBox"></div>
                        <p class="title" id="toastTitle"></p>
                    </div>
                    <button class="close-btn" id="closeBtn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
                <p class="message" id="toastMessage"></p>
                <div class="progress-bar" id="progressBar"></div>
            </div>
        `;

        this.closeBtn = this.shadowRoot.getElementById('closeBtn');
        this.closeBtn.addEventListener('click', () => this.hide());
    }

    connectedCallback() {
        this.updateContent();
    }

    static get observedAttributes() {
        return ['state', 'title', 'message'];
    }

    attributeChangedCallback() {
        this.updateContent();
    }

    updateContent() {
        const titleEl = this.shadowRoot.getElementById('toastTitle');
        const msgEl = this.shadowRoot.getElementById('toastMessage');
        const iconBox = this.shadowRoot.getElementById('iconBox');
        
        if (titleEl) titleEl.textContent = this.getAttribute('title') || 'Notification';
        if (msgEl) msgEl.textContent = this.getAttribute('message') || '';

        const state = this.getAttribute('state') || 'success';
        if (iconBox) {
            if (state === 'warning') iconBox.innerHTML = this.svgWarning;
            else if (state === 'failed' || state === 'error') iconBox.innerHTML = this.svgFailed;
            else iconBox.innerHTML = this.svgSuccess;
        }
    }

    show(title, message, state = 'success', duration = 5000) {
        this.setAttribute('title', title);
        this.setAttribute('message', message);
        this.setAttribute('state', state);
        
        // Reset animation by cloning element
        const pb = this.shadowRoot.getElementById('progressBar');
        const newPb = pb.cloneNode(true);
        newPb.style.animationDuration = `${duration}ms`;
        pb.parentNode.replaceChild(newPb, pb);

        this.classList.add('toast-active');

        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
            this.hide();
        }, duration);
    }

    hide() {
        this.classList.remove('toast-active');
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.timeoutId = null;
    }
}

customElements.define('toast-notification', ToastNotification);
