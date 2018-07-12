var IconViewer = {
  init: function() {
    document.querySelector('#headline .toggle').addEventListener('click', IconViewer.togglePlatform.bind(IconViewer));
    this.platforms = new Map();
    for (let platform of document.querySelectorAll('#headline .toggle span')) {
      this.platforms.set(platform.id.replace('toggle-', ''), platform.classList.contains('checked'));
    }

    this.iconListEl = document.querySelector("#icon-list");
    this.searchEl = document.querySelector("#search-input");
    if (this.searchEl) {
      this.searchEl.setAttribute("disabled", "disabled");
      this.searchEl.addEventListener("input", this.filterIcons.bind(this));
      if (location.hash) {
        this.searchEl.value = decodeURIComponent(location.hash.replace("#", ""));
      }
    }
    this.iconListEl.addEventListener("click", ({ target }) => {
      if (!target.classList.contains("icon-display")) {
        updateSidebar();
        return;
      }
      updateSidebar(target);
    });
    document.querySelector('#icon-details .close-button')
      .addEventListener('click', () => updateSidebar());
    document.querySelector('#download a').addEventListener('click', e => {
      // If it's a deprecated icon, don't let people download it.
      if (document.getElementById('icon-details').dataset.deprecated == "true") {
        e.preventDefault();
        return;
      }
      updateDownloadUrl();
      ga('send', 'event', 'icons', 'click', e.target.dataset.path);
    });
    this.previewEl = document.querySelector('#icon-details .preview');

    document.querySelector('#icon-details .options').addEventListener('change', updatePreview);

    this.showAllIcons();
  },

  getSelected() {
    return document.querySelector(".icon-display.selected");
  },

  setSelected(element) {
    let icons = document.querySelectorAll(".icon-display");
    icons.forEach(e => e.classList.toggle("selected", e === element));
  },

  displayCategory: function(category) {
    let categoryEl = createNode({
      tagName: "div",
      attributes: {
        class: "category-display",
        "data-category": category.name
      },
      parent: this.iconListEl
    });
    for (let item of category.items) {
      this.displayIcon(item, categoryEl, category.name);
    }
  },

  displayIcon: function(icon, container, category) {
    let iconContainer = createNode({
      tagName: "div",
      attributes: {
        class: "icon-display",
        download: icon.name + '.svg',
        target: "_blank",
        "data-icon": icon.name.toLowerCase(),
        "data-category": category,
        "data-tags": (icon.tags || []).join(','),
        "data-path": icon.location,
        "data-filename": icon.name + '.svg',
        "data-deprecated": icon.tags.indexOf("deprecated") != -1
      },
      parent: container
    });
    for (let platform in icon.source) {
      iconContainer.dataset[`uri_${platform}`] = IconList.getFullIconURI(icon, new Map([[platform, true]]));
    }
    let image = createNode({
      tagName: "img",
      attributes: {
        src: IconList.getFullIconURI(icon, this.platforms)
      },
      parent: iconContainer
    });
  },

  getIconUri: function(icon, platforms) {
    platforms = platforms || this.platforms;

    for (let [platform,enabled] of platforms) {
      let icon_uri = icon.dataset[`uri_${platform}`];
      if (enabled && icon_uri) {
        return icon_uri;
      }
    }
    return null;
  },

  filterIcons: function() {
    let query = "";
    if (this.searchEl) {
      query = this.searchEl.value.trim();
    }
    let allIcons = [].slice.call(this.iconListEl.querySelectorAll(".icon-display"));
    location.hash = "#" + query;
    query = query.toLowerCase();
    if (this.searchEl) {
      if (query == "") {
        this.searchEl.classList.remove("filled");
      } else {
        this.searchEl.classList.add("filled");
      }
    }
    for (let icon of allIcons) {
      if (icon.dataset.icon.indexOf(query) > -1 ||
          icon.dataset.category.indexOf(query) > -1 ||
          icon.dataset.tags.indexOf(query) > -1 ||
          query == "") {
        icon.classList.remove("hidden");
      } else {
        icon.classList.add("hidden");
      }
    }

    // Also specifically hide the ones that aren't on the specified platform.)
    nextIcon: for (let icon of allIcons) {
      if (!icon.classList.contains("hidden")) {
        let icon_uri = this.getIconUri(icon);
        if (icon_uri) {
          icon.childNodes[0].src = icon_uri;
        } else {
          icon.classList.add("hidden");
        }
      }
    }

    let categories = [].slice.call(this.iconListEl.querySelectorAll(".category-display"));
    for (let category of categories) {
      let numberOfHiddenItems = category.querySelectorAll(".hidden").length;
      if ((category.dataset.category.indexOf(query) > -1) ||
          query == "") {
        category.classList.remove("hidden");
      } else if (numberOfHiddenItems == category.childNodes.length) {
        category.classList.add("hidden");
      } else {
        category.classList.remove("hidden");
      }
    }
  },

  showAllIcons: function() {
    let categories = IconList.getAllCategories();
    for (let category of categories) {
      this.displayCategory(category);
    }
    document.getElementById("loading").remove();
    this.iconListEl.removeAttribute("hidden");
    if (this.searchEl) {
      this.searchEl.removeAttribute("disabled");
    }
    this.filterIcons();
  },

  togglePlatform: function(e) {
    let active = e.originalTarget.classList.contains('checked');
    let id = e.originalTarget.id.replace('toggle-', '');
    this.platforms.set(id, !active);
    e.originalTarget.classList.toggle('checked');
    this.filterIcons();
  }
};

window.addEventListener("DOMContentLoaded", IconViewer.init.bind(IconViewer));

// Helpers
function createNode(options) {
  let el = document.createElement(options.tagName || "div");

  if (options.attributes) {
    for (let i in options.attributes) {
      el.setAttribute(i, options.attributes[i]);
    }
  }

  if (options.textContent) {
    el.textContent = options.textContent;
  }

  if (options.parent) {
    options.parent.appendChild(el);
  }

  return el;
}

function updateSidebar(icon) {
  let details = document.getElementById('icon-details');
  details.classList.toggle('show', !!icon);

  IconViewer.setSelected(icon);

  if (!icon) {
    return;
  }

  ga('send', 'event', 'icons', 'preview', icon.dataset.path);

  let selectedFill = document.querySelector("input[name='fill']:checked").value;

  details.querySelector('.name').textContent = icon.dataset.icon;
  details.dataset.deprecated = icon.dataset.deprecated;
  updatePreview();
}

function updatePreview(e) {
  // Figure out the current platform.
  let selectedFormat = document.querySelector(".platform.section input:checked").value;
  if (selectedFormat == "svg") {
    selectedFormat = "desktop";
  }
  let icon_uri = IconViewer.getIconUri(IconViewer.getSelected(), new Map([[selectedFormat, true]]));
  if (!icon_uri) {
    return;
  }
  fetch(icon_uri).then(response => {
    return response.text();
  }).then(innerHTML => {
    let icon = document.querySelector('#icon-details .preview .icon');
    icon.innerHTML = innerHTML;

    let fills = ['context-fill', 'light', 'dark'];
    let selected = document.querySelector("input[name='fill']:checked");
    if (fills.includes(selected.id)) {
      for (let id of fills) {
        IconViewer.previewEl.classList.toggle(id, selected.id === id);
      }
    }
    let elements = IconViewer.previewEl.querySelectorAll('[fill="context-fill"]');
    elements.forEach(el => {
      el.setAttribute('fill', selected.value);
    });

    updateDownloadUrl();
  });
}

function updateDownloadUrl() {
  let selectedFormat = document.querySelector(".platform.section input:checked").value;
  let selectedIcon = IconViewer.getSelected();

  let svg = document.querySelector("#icon-details .preview .icon").innerHTML;
  let url = FORMATS[selectedFormat].export(svg);
  let download = document.querySelector('#download a');
  download.href = url;
  download.setAttribute('download', selectedIcon.dataset.filename);
  download.dataset.path = selectedIcon.dataset.path;
}
