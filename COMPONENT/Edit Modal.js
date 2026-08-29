window.EditModalManager = (function () {
  const modalHTML = `
<!-- =====================================================
       DETAIL MODAL (fully preserved)
       ===================================================== -->
<div class="mi-modal" id="detail-modal" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="mi-modal-backdrop" data-close></div>
  <button class="mi-detail-nav-btn mi-detail-nav-btn--previous" id="btn-detail-previous" aria-label="Previous icon">
    <img src="ASSET/Icons/previous-arrow.svg" alt="" />
  </button>
  <button class="mi-detail-nav-btn mi-detail-nav-btn--next" id="btn-detail-next" aria-label="Next icon">
    <img src="ASSET/Icons/next-arrow.svg" alt="" />
  </button>
  <button class="mi-new-topbtn mi-new-close-btn float-close" data-close aria-label="Close">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <div class="mi-modal-card mi-new-modal">
    
    <!-- Topbar -->
    <div class="mi-new-topbar">
      <nav class="mi-new-crumbs" id="crumbs" aria-label="Breadcrumb">
        <a href="/icons" class="mi-new-crumb">Icons</a>
        <span class="mi-new-crumb-sep"><svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <a href="#" class="mi-new-crumb" id="crumb-category">Interface</a>
        <span class="mi-new-crumb-sep"><svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="mi-new-crumb mi-new-crumb--current" id="crumb-name">Filter</span>
      </nav>
      <div class="mi-new-topbar-actions">
        <button class="mi-new-topbtn" id="btn-share" aria-label="Share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
        </button>
        <button class="mi-new-topbtn" id="btn-help" aria-label="Keyboard shortcuts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        <button class="mi-new-topbtn" id="btn-expand" aria-label="Open as page">
          <svg class="mi-icon-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          <svg class="mi-icon-collapse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
        <button class="mi-new-topbtn topbar-close" data-close aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6L20 20M20 6L6 20"></path></svg>
        </button>
      </div>
    </div>

    <!-- SCROLLABLE AREA -->
    <div class="mi-new-scroll-area">
    
    <div class="mi-new-body">
      <!-- LEFT PANEL -->
      <div class="mi-new-left">
        <div class="mi-new-left-content">
        <!-- Customize -->
        <details class="mi-new-section" open>
          <summary class="mi-new-section-header mi-new-summary">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" class="mi-new-section-icon"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Customize</span>
          </summary>

          <div class="mi-new-ctrl-group">
          <div class="mi-new-ctrl">
            <div class="mi-new-ctrl-top"><span>Size</span><span id="size-val">20</span></div>
            <div class="mi-rp-slider-wrapper">
              <input type="range" id="ctrl-size" class="mi-rp-slider-invisible" min="12" max="128" value="20" step="1" />
              <div class="mi-rp-slider-container">
                <div class="mi-rp-slider-track">
                  <div class="mi-rp-slider-fill" id="ctrl-size-fill" style="width:6%"></div>
                </div>
                <div class="mi-rp-slider-thumb" id="ctrl-size-thumb" style="left:6%"></div>
              </div>
            </div>
            <div class="mi-new-quick">
              <button data-size="16">16</button>
              <button data-size="20" class="is-active">20</button>
              <button data-size="24">24</button>
              <button data-size="32">32</button>
            </div>
          </div>
          
          <div class="mi-new-ctrl mi-ctrl-group" id="grp-stroke-mode">
            <div class="mi-new-ctrl-top"><span>Stroke</span><span id="stroke-val">1.5</span></div>
            <div class="mi-rp-slider-wrapper">
              <input type="range" id="ctrl-stroke" class="mi-rp-slider-invisible" min="1" max="2" value="1.5" step="0.25" />
              <div class="mi-rp-slider-container">
                <div class="mi-rp-slider-track">
                  <div class="mi-rp-slider-fill" id="ctrl-stroke-fill" style="width:50%"></div>
                </div>
                <div class="mi-rp-slider-thumb" id="ctrl-stroke-thumb" style="left:50%"></div>
              </div>
            </div>
            <div class="mi-new-quick">
              <button data-stroke="1">1</button>
              <button data-stroke="1.5" class="is-active">1.5</button>
              <button data-stroke="1.75">1.75</button>
              <button data-stroke="2">2</button>
            </div>
          </div>
          
          <div class="mi-new-ctrl" id="grp-color-mode">
            <div class="mi-new-ctrl-top"><span>Color</span></div>
            <div class="mi-new-color-input">
              <input type="color" id="ctrl-color" value="#000000" />
              <input type="text" id="ctrl-color-hex" value="#000000" class="mi-new-hex" />
            </div>
            <div class="mi-new-swatches">
              <button style="background:#0F1116" data-color="#0F1116"></button>
              <button style="background:#5C4AE4" data-color="#5C4AE4"></button>
              <button style="background:#2563EB" data-color="#2563EB"></button>
              <button style="background:#059669" data-color="#059669"></button>
              <button style="background:#DC2626" data-color="#DC2626"></button>
              <button style="background:#F59E0B" data-color="#F59E0B"></button>
              <button style="background:#4F91EF" data-color="#4F91EF"></button>
            </div>
          </div>
          
          <div class="mi-new-ctrl" id="grp-fill-mode">
            <div class="mi-new-ctrl-top"><span>Fill</span></div>
            <div class="mi-new-seg">
              <button class="mi-new-seg-btn is-active" data-fill="none">None</button>
              <button class="mi-new-seg-btn" data-fill="solid">Solid</button>
            </div>
            <div id="grp-fill-color" class="mi-new-color-input" style="display:none;margin-top:8px;">
              <input type="color" id="ctrl-fill-color" value="#5C4AE4" />
              <input type="text" id="ctrl-fill-color-hex" value="#5C4AE4" class="mi-new-hex" />
            </div>
          </div>
          
          <div class="mi-new-ctrl">
            <div class="mi-new-ctrl-top"><span>Background</span></div>
            <div class="mi-new-color-input">
              <input type="color" id="ctrl-bg" value="#ffffff" />
              <input type="text" id="ctrl-bg-hex" value="#ffffff" class="mi-new-hex" />
            </div>
            <div class="mi-new-swatches">
              <button style="background: repeating-conic-gradient(#eee 0% 25%, white 0% 50%) 50% / 12px 12px; border-color:#EAEAEE" data-bg="transparent" aria-label="Transparent background"></button>
              <button style="background:#FFFFFF; border-color:#EAEAEE" data-bg="#FFFFFF" aria-label="White background"></button>
              <button style="background:#F5F5F7; border-color:#EAEAEE" data-bg="#F5F5F7" aria-label="Light gray background"></button>
              <button style="background:#0F1116" data-bg="#0F1116" aria-label="Black background"></button>
              <button style="background:#5C4AE4" data-bg="#5C4AE4" aria-label="Purple background"></button>
              <button style="background:#2563EB" data-bg="#2563EB" aria-label="Blue background"></button>
              <button style="background:#059669" data-bg="#059669" aria-label="Green background"></button>
            </div>
          </div>
          </div>
        </details>
        
        <div class="mi-new-divider" id="grp-stroke-divider"></div>
        
        <!-- Advanced -->
        <details class="mi-new-section" id="grp-stroke-section" open>
          <summary class="mi-new-section-header mi-new-summary">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" class="mi-new-section-icon"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Stroke</span>
          </summary>
          <div class="mi-new-ctrl-group">
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Cap</span></div>
              <div class="mi-new-seg">
                <button class="mi-new-seg-btn is-active" data-cap="round">Round</button>
                <button class="mi-new-seg-btn" data-cap="butt">Butt</button>
                <button class="mi-new-seg-btn" data-cap="square">Square</button>
              </div>
            </div>
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Join</span></div>
              <div class="mi-new-seg">
                <button class="mi-new-seg-btn is-active" data-join="round">Round</button>
                <button class="mi-new-seg-btn" data-join="bevel">Bevel</button>
                <button class="mi-new-seg-btn" data-join="miter">Miter</button>
              </div>
            </div>
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Pattern</span></div>
              <div class="mi-new-seg">
                <button class="mi-new-seg-btn is-active" data-pattern="solid">Solid</button>
                <button class="mi-new-seg-btn" data-pattern="dashed">Dashed</button>
                <button class="mi-new-seg-btn" data-pattern="dotted">Dotted</button>
              </div>
            </div>
          </div>
        </details>
        
        <div class="mi-new-divider"></div>

        <details class="mi-new-section">
          <summary class="mi-new-section-header mi-new-summary">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" class="mi-new-section-icon"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Transform</span>
          </summary>
          <div class="mi-new-ctrl-group">
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Rotation</span><span id="rot-val">0°</span></div>
              <div class="mi-rp-slider-wrapper">
                <input type="range" id="ctrl-rot" class="mi-rp-slider-invisible" min="-180" max="180" value="0" />
                <div class="mi-rp-slider-container">
                  <div class="mi-rp-slider-track">
                    <div class="mi-rp-slider-fill" id="ctrl-rot-fill" style="width:50%"></div>
                  </div>
                  <div class="mi-rp-slider-thumb" id="ctrl-rot-thumb" style="left:50%"></div>
                </div>
              </div>
            </div>
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Padding</span><span id="pad-val">20</span></div>
              <div class="mi-rp-slider-wrapper">
                <input type="range" id="ctrl-pad" class="mi-rp-slider-invisible" min="0" max="24" value="20" />
                <div class="mi-rp-slider-container">
                  <div class="mi-rp-slider-track">
                    <div class="mi-rp-slider-fill" id="ctrl-pad-fill" style="width:83%"></div>
                  </div>
                  <div class="mi-rp-slider-thumb" id="ctrl-pad-thumb" style="left:83%"></div>
                </div>
              </div>
            </div>
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Flip</span></div>
              <div class="mi-new-seg">
                <button class="mi-new-seg-btn is-active" data-flip="none">None</button>
                <button class="mi-new-seg-btn" data-flip="h">Hori</button>
                <button class="mi-new-seg-btn" data-flip="v">Vertical</button>
              </div>
            </div>
          </div>
        </details>

        <div class="mi-new-divider"></div>

        <details class="mi-new-section">
          <summary class="mi-new-section-header mi-new-summary">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" class="mi-new-section-icon"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Effects</span>
          </summary>
          <div class="mi-new-ctrl-group">
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Opacity</span><span id="opa-val">60%</span></div>
              <div class="mi-rp-slider-wrapper">
                <input type="range" id="ctrl-opa" class="mi-rp-slider-invisible" min="10" max="100" value="60" />
                <div class="mi-rp-slider-container">
                  <div class="mi-rp-slider-track">
                    <div class="mi-rp-slider-fill" id="ctrl-opa-fill" style="width:56%"></div>
                  </div>
                  <div class="mi-rp-slider-thumb" id="ctrl-opa-thumb" style="left:56%"></div>
                </div>
              </div>
            </div>
            <div class="mi-new-ctrl">
              <div class="mi-new-ctrl-top"><span>Shadow</span><span id="shd-val">12</span></div>
              <div class="mi-rp-slider-wrapper">
                <input type="range" id="ctrl-shd" class="mi-rp-slider-invisible" min="0" max="12" value="12" />
                <div class="mi-rp-slider-container">
                  <div class="mi-rp-slider-track">
                    <div class="mi-rp-slider-fill" id="ctrl-shd-fill" style="width:100%"></div>
                  </div>
                  <div class="mi-rp-slider-thumb" id="ctrl-shd-thumb" style="left:100%"></div>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div class="mi-new-divider"></div>

        <details class="mi-new-section">
          <summary class="mi-new-section-header mi-new-summary">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" class="mi-new-section-icon"><path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#6B7280" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Background shape</span>
          </summary>
          <div class="mi-new-ctrl-group">
          <div class="mi-new-ctrl">
            <div class="mi-new-ctrl-top"><span>Shapes</span></div>
            <div class="mi-new-shape-seg">
              <button class="mi-new-shape-btn is-active" data-shape="none"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l12 12M16 4L4 16"/></svg></button>
              <button class="mi-new-shape-btn" data-shape="rect"><svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="14" height="14"/></svg></button>
              <button class="mi-new-shape-btn" data-shape="rounded"><svg viewBox="0 0 20 20" fill="currentColor"><rect x="3" y="3" width="14" height="14" rx="4"/></svg></button>
              <button class="mi-new-shape-btn" data-shape="circle"><svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="7"/></svg></button>
            </div>
          </div>
          <div class="mi-new-ctrl" id="grp-shape-color" style="display:none;">
            <div class="mi-new-ctrl-top"><span>Shape colors</span></div>
            <div class="mi-new-color-input">
              <input type="color" id="ctrl-shape-color" value="#5C4AE4" />
              <input type="text" id="ctrl-shape-color-hex" value="#5C4AE4" class="mi-new-hex" />
            </div>
            <div class="mi-new-swatches">
              <button style="background:#0F1116" data-shape-color="#0F1116"></button>
              <button style="background:#5C4AE4" data-shape-color="#5C4AE4"></button>
              <button style="background:#2563EB" data-shape-color="#2563EB"></button>
              <button style="background:#059669" data-shape-color="#059669"></button>
              <button style="background:#DC2626" data-shape-color="#DC2626"></button>
              <button style="background:#F59E0B" data-shape-color="#F59E0B"></button>
              <button style="background:#4F91EF" data-shape-color="#4F91EF"></button>
            </div>
          </div>
          <div class="mi-new-ctrl" id="grp-icon-inset" style="display:none;">
            <div class="mi-new-ctrl-top"><span>Icon inset</span><span id="icon-inset-val">6.5</span></div>
            <div class="mi-rp-slider-wrapper">
              <input type="range" id="ctrl-icon-inset" class="mi-rp-slider-invisible" min="0" max="8" value="6.5" step="0.5" />
              <div class="mi-rp-slider-container">
                <div class="mi-rp-slider-track">
                  <div class="mi-rp-slider-fill" id="ctrl-icon-inset-fill" style="width:81%"></div>
                </div>
                <div class="mi-rp-slider-thumb" id="ctrl-icon-inset-thumb" style="left:81%"></div>
              </div>
            </div>
          </div>
          <div class="mi-new-ctrl" id="grp-shape-radius" style="display:none;">
            <div class="mi-new-ctrl-top"><span>Corner radius</span><span id="shape-radius-val">4</span></div>
            <div class="mi-rp-slider-wrapper">
              <input type="range" id="ctrl-shape-radius" class="mi-rp-slider-invisible" min="0" max="12" value="4" step="0.5" />
              <div class="mi-rp-slider-container">
                <div class="mi-rp-slider-track">
                  <div class="mi-rp-slider-fill" id="ctrl-shape-radius-fill" style="width:33%"></div>
                </div>
                <div class="mi-rp-slider-thumb" id="ctrl-shape-radius-thumb" style="left:33%"></div>
              </div>
            </div>
          </div>
          </div>
        </details>
        </div>
        <button type="button" class="mi-new-reset-btn" id="btn-reset">Reset all</button>
      </div>
      
      <!-- CENTER PANEL -->
      <div class="mi-new-center">
        <div class="mi-new-canvas-box" id="canvas">
          <div id="canvas-grid" class="mi-new-canvas-grid"></div>

          <div id="canvas-inner" class="mi-new-canvas-inner"></div>
          <!-- Not exposing grid toggle since it's not in the new layout but let's keep the ID hidden or integrate it -->
          <button id="btn-toggle-grid" style="display:none;"></button>
        </div>
        
        <div class="mi-new-center-info">
          <div class="mi-new-title-group">
            <h2 id="detail-name">filter</h2>
            <div class="mi-new-badges">
              <span id="detail-source" class="mi-new-badge-primary">Lucide</span>
              <span id="detail-license" class="mi-new-badge-secondary">ISC</span>
            </div>
          </div>
          <div class="mi-new-action-group">
            <button class="mi-new-btn-save-collection" id="btn-save-collection">
              <img src="ASSET/Icons/edit-modal-unsave.svg" alt="" id="save-collection-icon" data-saved="false" />
              <span id="save-collection-text">Save</span>
            </button>
            <button class="mi-new-btn" id="btn-find-similar">Find Similar</button>
          </div>
        </div>
        
        <div class="mi-new-similar-block">
          <h3>Similar icons</h3>
          <div class="mi-new-similar" id="similar-row">
            <!-- populated by JS -->
          </div>
        </div>
      </div>
      
      <!-- RIGHT PANEL -->
      <div class="mi-new-right">
        <div class="mi-new-right-inner">
          <section class="mi-new-banner" aria-label="Motvin Icons promotion">
            <div class="mi-new-banner-img-inner">
              <img src="ASSET/svg/motvin-edit-pannel-logo.svg" alt="Motvin Icons" />
            </div>
            <div class="mi-new-banner-text">
              <div class="mi-new-banner-copy">
                <h4><span class="mi-new-banner-title-icon"><img src="ASSET/Icons/global.svg" alt="" /></span>World Largest Free Library</h4>
                <p>Explore millions of icons to bring every creative idea to life.</p>
              </div>
              <button class="mi-new-btn-white" type="button">
                <img src="ASSET/Icons/bell.svg" alt="" />
                <span>Follow for updates</span>
              </button>
            </div>
            <button class="mi-new-banner-close" type="button" aria-label="Dismiss promotion">
              <img src="ASSET/Icons/motvin-edit-pannel-promo-close.svg" alt="" />
            </button>
          </section>
          
          <div class="mi-new-export">
            <h3>Export settings</h3>
            <div class="mi-new-export-grid">
               <!-- SVG Row -->
               <div class="mi-new-export-row">
                 <div class="mi-new-split-btn mi-svg-group">
                   <button class="mi-new-btn-green" id="btn-copy-svg"><span id="svg-fmt-label">Copy SVG</span></button>
                   <button id="btn-svg-format" class="mi-new-btn-green-icon">
                     <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                   </button>
                   <div class="mi-category-menu" id="svg-dropdown">
                     <div class="mi-category-menu-inner">
                       <button class="mi-category-menu-item is-active" data-fmt="svg">SVG</button>
                       <button class="mi-category-menu-item" data-fmt="jsx">JSX / React</button>
                       <button class="mi-category-menu-item" data-fmt="vue">Vue</button>
                       <button class="mi-category-menu-item" data-fmt="html">HTML &lt;img&gt;</button>
                       <button class="mi-category-menu-item" data-fmt="css">CSS mask URL</button>
                       <button class="mi-category-menu-item" data-fmt="dataurl">Data URL</button>
                       <button class="mi-category-menu-item" data-fmt="base64">Base64 PNG</button>
                     </div>
                   </div>
                 </div>
                 <button class="mi-new-btn-gray" id="btn-download-svg">Download SVG</button>
               </div>
               
               <!-- PNG Row -->
               <div class="mi-new-export-row">
                 <div class="mi-new-split-btn">
                   <button class="mi-new-btn-white-border" id="btn-download-png">PNG</button>
                   <div class="mi-new-btn-white-icon mi-new-select-box mi-png-group">
                      <button id="btn-png-size" class="mi-new-btn-white-border-right"><span id="png-size-label">512px</span> <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                      <div class="mi-category-menu" id="png-dropdown">
                        <div class="mi-category-menu-inner">
                          <button data-png="512" class="mi-category-menu-item">512px</button>
                          <button data-png="256" class="mi-category-menu-item">256px</button>
                          <button data-png="128" class="mi-category-menu-item">128px</button>
                          <button data-png="64" class="mi-category-menu-item">64px</button>
                          <button data-png="32" class="mi-category-menu-item">32px</button>
                          <button data-png="24" class="mi-category-menu-item">24px</button>
                          <button data-png="16" class="mi-category-menu-item">16px</button>
                        </div>
                      </div>
                   </div>
                 </div>

                  <div class="mi-new-select-box mi-copy-group" style="flex:1;">
                    <button class="mi-new-btn-white-border" style="width:100%; border-radius:10px;" id="btn-copy-fmt"><span id="copy-fmt-label">Copy PNG</span></button>
                    <button id="btn-copy-jsx" style="display:none;"></button>
                    <div class="mi-category-menu" id="copy-fmt-dropdown" role="listbox" style="display:none;">
                     <div class="mi-category-menu-inner">
                       <button class="mi-category-menu-item is-active" data-fmt="svg" role="option">SVG</button>
                       <button class="mi-category-menu-item" data-fmt="jsx" role="option">JSX / React</button>
                       <button class="mi-category-menu-item" data-fmt="vue" role="option">Vue</button>
                       <button class="mi-category-menu-item" data-fmt="html" role="option">HTML &lt;img&gt;</button>
                       <button class="mi-category-menu-item" data-fmt="css" role="option">CSS mask URL</button>
                       <button class="mi-category-menu-item" data-fmt="dataurl" role="option">Data URL</button>
                       <button class="mi-category-menu-item" data-fmt="base64" role="option">Base64 PNG</button>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          <div class="mi-new-code">
            <div class="mi-new-code-header">
              <span id="code-preview-title">SVG code</span>
              <button id="btn-copy-code" class="mi-new-copy-mini"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6V4C6 3.44772 6.44772 3 7 3H12C12.5523 3 13 3.44772 13 4V9C13 9.55228 12.5523 10 12 10H10M6 6H4C3.44772 6 3 6.44772 3 7V12C3 12.5523 3.44772 13 4 13H9C9.55228 13 10 12.5523 10 12V10M6 6H10V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copy</button>
            </div>
            <pre id="code-preview" class="mi-new-code-pre"><code></code></pre>
          </div>
          
          <div class="mi-new-divider"></div>

          <div class="mi-new-attrib">
            <h3>License &amp; Attribution</h3>
            <div class="mi-new-attrib-content">
              <div class="mi-new-attr-row">
                <span>Source &amp; License</span>
                <span class="mi-new-attr-license"><span><span id="attr-source">Lucide</span>,</span> <a href="#" id="attr-license-link" target="_blank" rel="noopener noreferrer"><span id="attr-license">ISC</span><img src="ASSET/Icons/Motvin/license-arrow.svg" alt="" /></a></span>
              </div>
              <div class="mi-new-attr-row"><span>Attribution</span><span id="attr-attribution">Not required</span></div>
              <div class="mi-new-attr-row"><span>Commercial Use</span><span id="attr-commercial">Allowed</span></div>
            </div>
            <div class="mi-new-attrib-note">
              <img src="ASSET/Icons/Motvin/license-note.svg" alt="" />
              <p>Third-party asset. Copyright and license remain with the original creator. Motvin does not claim ownership of third-party artwork.</p>
            </div>
          </div>

        </div>
      </div>
      
    </div>
    
    <!-- BOTTOM PANEL: MORE RELEVANT ICONS -->
    <div class="mi-new-bottom">
      <div class="mi-new-bottom-header">
        <h2 id="matching-icons-title">More relevant icons</h2>
      </div>
      <div class="mi-new-bottom-grid" id="matching-icons-grid">
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div class="mi-new-more-tag">search</div>
          <div class="mi-new-more-source">Radix Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div class="mi-new-more-tag">search</div>
          <div class="mi-new-more-source">IconPark</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div class="mi-new-more-tag">search</div>
          <div class="mi-new-more-source">Lucide</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Solar</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Radix Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Lucide</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Flaticon</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Heroicons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div class="mi-new-more-tag">grid</div>
          <div class="mi-new-more-source">Solar</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></div>
          <div class="mi-new-more-tag">filter</div>
          <div class="mi-new-more-source">Lucide</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div class="mi-new-more-tag">grid</div>
          <div class="mi-new-more-source">Fluent UI</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Bootstrap Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div class="mi-new-more-tag">grid</div>
          <div class="mi-new-more-source">Bootstrap Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div class="mi-new-more-tag">search</div>
          <div class="mi-new-more-source">Bootstrap Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></div>
          <div class="mi-new-more-tag">filter</div>
          <div class="mi-new-more-source">Flaticon</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div class="mi-new-more-tag">grid</div>
          <div class="mi-new-more-source">Fluent UI</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="mi-new-more-tag">menu</div>
          <div class="mi-new-more-source">Bootstrap Icons</div>
        </div>
        <div class="mi-new-more-card">
          <div class="mi-new-more-icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <div class="mi-new-more-tag">grid</div>
          <div class="mi-new-more-source">Bootstrap Icons</div>
        </div>
      </div>
    </div>
    
    </div> <!-- END SCROLL AREA -->
  </div>
</div>
  `;

  function init() {
    if (!document.getElementById('detail-modal')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
  }
      
  function updateSaveState(isSaved) {
    const icon = document.getElementById('save-collection-icon');
    const text = document.getElementById('save-collection-text');
    if (!icon || !text) return;
    
    if (isSaved) {
      icon.dataset.saved = 'true';
      icon.src = 'ASSET/Icons/edit-modal-saved.svg';
      text.textContent = 'Saved';
    } else {
      icon.dataset.saved = 'false';
      icon.src = 'ASSET/Icons/edit-modal-unsave.svg';
      text.textContent = 'Save';
    }
  }

  return { init, updateSaveState };
})();

window.EditModalManager.init();
