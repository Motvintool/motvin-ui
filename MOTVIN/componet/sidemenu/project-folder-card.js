class ProjectFolderCard extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    // Static base markup – state-specific visuals handled by CSS + storage.js
    const folderName = this.getAttribute('folder-name') || 'Untitled Project';

    // Figma-derived icons (folder + chevron + status)
    const folderIcon = 'assets/icon/icon-folder.svg';
    const chevronIcon = 'assets/icon/icon-storage-settings.svg';
    const disconnectedIcon = 'assets/icon/icon-disconnected.svg';

    this.innerHTML = `
      <div class="sidemenu-preview-card" id="projectFolderConnector">
        <div class="sidemenu-preview-left">
          <div class="sidemenu-folder-icon">
            <img src="${folderIcon}" alt="Folder" width="20" height="20">
          </div>
          <div class="sidemenu-folder-info">
            <span class="sidemenu-folder-name" id="connectorFolderName">${folderName}</span>
            <div class="sidemenu-connection" id="connectorStatusGroup">
              <img id="connectorStatusCheck" src="${disconnectedIcon}" alt="Disconnected" width="12" height="12">
              <span class="sidemenu-connection-status" id="connectorStatusText">Disconnected</span>
            </div>
          </div>
        </div>
        <div class="connector-trigger" id="connectorTrigger" aria-label="Storage settings" role="button" tabindex="0">
          <img class="sidemenu-swap-icon" src="${chevronIcon}" alt="Open storage settings" width="20" height="20">
        </div>
      </div>
    `;
  }
}

customElements.define('project-folder-card', ProjectFolderCard);
