
class Tag extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    border-radius: 20px;
                    padding: 8px !important;
                    display: inline-flex;
                    box-shadow: 0 2px 3px 0 #ccc;
                    cursor: pointer;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                }
                :host(:hover) {
                    background: #eee;
                    color: #333;
                }
                .tag-content {
                    font-size: 14px;
                    font-weight: 600;
                }
                .close-icon {
                    display: none;
                    margin-left: 5px;
                    text-align: center;
                    font-size: 14px;
                    color: #aaa;
                    border-radius: 50px;
                    background: #fff;
                    cursor: pointer;
                    font-weight: bold;
                    padding: 1px;
                }
                .close-icon:hover {
                    background: #eee;
                    color: #111;
                }
                :host([selected]) {
                    background: #2196f3;
                    color: #fff;
                }
                :host([selected]:hover) {
                    background: #1e88e5;
                    color: #fff;
                }
                :host([selected]) .close-icon {
                    color: #fff;
                    background: #111;
                }
                :host([selected]:hover) .close-icon {
                    background: #eee;
                    color: #111;
                }
            </style>
            <span class="tag-content" tabindex="0">
                <slot></slot>
                <span class="close-icon" role="button">x</span>
            </span>
        `;
        this.addEventListener('click', this.toggleActive);
    }

    toggleActive() {
        const eventDetails = {
            detail: {
                value: this.getAttribute('data-value'),
                selected: !this.hasAttribute('selected')
            }
        };
        if (this.hasAttribute('selected')) {
            this.removeAttribute('selected');
        } else {
            this.setAttribute('selected', '');
        }
        this.dispatchEvent(new CustomEvent('tag-toggle', eventDetails));
    }
}

customElements.define('tag-element', Tag);

class TagGroup extends HTMLElement {
    constructor() {
        super();
        this.selectedTags = [];
        this.plusButton = document.createElement('button');
        this.plusButton.className = 'material-icons tag-add';
        this.plusButton.textContent = 'add';
        this.plusButton.title = 'Add new tags';
        this.plusButton.addEventListener('click', this.addTagsPrompt.bind(this));
        this.addEventListener('tag-toggle', this.handleTagToggle.bind(this));
    }

    connectedCallback() {
        this.appendChild(this.plusButton);
        this.setAttribute('role', 'group'); // ARIA role for better accessibility
    }

    handleTagToggle(event) {
        const { value, selected } = event.detail;
        if (selected) {
            if (this.getAttribute('mode') === 'single') {
                this.selectedTags = [value];
                this.querySelectorAll('tag[selected]').forEach(tagElement => {
                    if (tagElement.getAttribute('data-value') !== value) {
                        tagElement.toggleActive();
                    }
                });
            } else {
                this.selectedTags.push(value);
            }
        } else {
            const index = this.selectedTags.indexOf(value);
            if (index > -1) {
                this.selectedTags.splice(index, 1);
            }
        }
        this.dispatchEvent(new CustomEvent('tag-group-update', { detail: { selectedTags: this.selectedTags } }));
    }

    addTagsPrompt() {
        const placeholder = this.getAttribute('data-prompt-placeholder') || 'Enter new tags, comma-separated';
        const newTags = prompt(placeholder);
        if (newTags) {
            newTags.split(',').forEach(tagValue => {
                const cleanedTag = tagValue.trim();
                if (cleanedTag && !this.querySelector(`tag[data-value="${cleanedTag}"`)) {
                    const newTag = document.createElement('tag-element');
                    newTag.setAttribute('data-value', cleanedTag);
                    newTag.textContent = cleanedTag;
                    this.insertBefore(newTag, this.plusButton);
                }
            });
            this.dispatchEvent(new CustomEvent('tags-added', { detail: { addedTags: newTags.split(',').map(tag => tag.trim()) } }));
        }
    }

    addTag(tagValue) {
        const cleanedTag = tagValue.trim();
        if (cleanedTag && !this.querySelector(`tag[data-value="${cleanedTag}"`)) {
            const newTag = document.createElement('tag-element');
            newTag.setAttribute('data-value', cleanedTag);
            newTag.textContent = cleanedTag;
            this.insertBefore(newTag, this.plusButton);
            this.dispatchEvent(new CustomEvent('tags-added', { detail: { addedTags: [cleanedTag] } }));
        }
    }

    removeTag(tagValue) {
        const tagToRemove = this.querySelector(`tag[data-value="${tagValue}"`);
        if (tagToRemove) {
            this.removeChild(tagToRemove);
            this.dispatchEvent(new CustomEvent('tag-removed', { detail: { removedTag: tagValue } }));
        }
    }

    clearTags() {
        this.querySelectorAll('tag-element').forEach(tag => this.removeChild(tag));
        this.selectedTags = [];
    }

    getTags() {
        return [...this.querySelectorAll('tag-element')].map(tag => tag.getAttribute('data-value'));
    }

}

customElements.define('tag-group', TagGroup);