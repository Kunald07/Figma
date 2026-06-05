// DOM References
const requestArea = document.querySelector('.canvas-area');
const follower = document.querySelector('.mouse-follower');
const followerImg = follower ? follower.querySelector('img') : null;
const header = document.querySelector('.sidebar-header');
let fileNameEl = document.querySelector('.file-name');
const toolGroups = document.querySelectorAll('.tool-group');
const layersContainer = document.querySelector('.section-content');
const propertiesPanel = document.querySelector('.properties-panel');
const framePanel = document.querySelector('.frame-panel');
const framePresets = framePanel ? framePanel.querySelectorAll('.preset-btn') : [];
const exportBtn = document.querySelector('.export-btn');
const exportPanel = document.querySelector('.export-panel');
const btnExportJson = document.getElementById('btn-export-json');
const btnExportHtml = document.getElementById('btn-export-html');

const propInputs = {
    width: document.getElementById('prop-width'),
    height: document.getElementById('prop-height'),
    color: document.getElementById('prop-color'),
    hex: document.getElementById('prop-color-hex'),
    radius: document.getElementById('prop-radius'),
    text: document.getElementById('prop-text'),
    textRow: document.getElementById('prop-text-row'),
    fontSize: document.getElementById('prop-font-size'),
    textColor: document.getElementById('prop-text-color'),
    textStyleRow: document.getElementById('prop-text-style-row')
};

// State Variables
let currentTool = 'mouse-pointer-2';
let isDrawing = false;
let isResizing = false;
let isDragging = false;
let isRotating = false;
let startPos = { x: 0, y: 0 };
let currentElement = null;
let selectedElement = null;
let resizeHandle = null;
let elementCount = 1;
let textCount = 1;

let startState = {
    mouseX: 0,
    mouseY: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    rotation: 0
};

const savedName = localStorage.getItem('fileName');
if (savedName) {
    fileNameEl.textContent = savedName;
}

if (requestArea && follower) {
    requestArea.addEventListener('mousemove', (e) => {
        const rect = requestArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        follower.style.transform = `translate(${x}px, ${y}px)`;
    });

    requestArea.addEventListener('mouseenter', () => {
        follower.style.opacity = '1';
    });

    requestArea.addEventListener('mouseleave', () => {
        follower.style.opacity = '0';
    });
}

toolGroups.forEach(tool => {
    tool.addEventListener('click', () => {
        toolGroups.forEach(t => t.classList.remove('active'));
        tool.classList.add('active');
        const icon = tool.querySelector('[data-lucide]');
        if (icon) {
            const iconName = icon.getAttribute('data-lucide');
            if (iconName === 'mouse-pointer-2') {
                followerImg.src = 'Assests/cursor.png';
            } else if (['frame', 'square', 'type', 'message-circle'].includes(iconName)) {
                followerImg.src = 'Assests/plus.png';
            }
            currentTool = iconName;
            updateRightSidebar();
        }
    });
});

function updateRightSidebar() {
    if (currentTool === 'frame') {
        framePanel.style.display = 'block';
        propertiesPanel.style.display = 'none';
    } else {
        framePanel.style.display = 'none';
        if (selectedElement) {
            propertiesPanel.style.display = 'block';
        }
    }
}

header.addEventListener('click', (e) => {
    if (e.target.closest('.action-icon')) {
        startEditing();
    }
});

function startEditing() {
    if (document.querySelector('.file-name-input')) return;

    const currentName = fileNameEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'file-name-input';

    header.replaceChild(input, fileNameEl);
    input.focus();

    function saveAndRevert() {
        const newName = input.value.trim() || 'Untitled';
        const newSpan = document.createElement('span');
        newSpan.className = 'file-name';
        newSpan.textContent = newName;

        if (input.parentNode === header) {
            header.replaceChild(newSpan, input);
            fileNameEl = newSpan;
            localStorage.setItem('fileName', newName);
        }
    }

    input.addEventListener('blur', saveAndRevert);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveAndRevert();
        }
    });
}

function getRotation(element) {
    return parseFloat(element.dataset.rotation) || 0;
}

requestArea.addEventListener('click', (e) => {
    if (isDragging || isResizing || isRotating) return;
    if (currentTool !== 'mouse-pointer-2') return;

    if (e.target === requestArea) {
        deselectElement();
        return;
    }

    if (e.target.classList.contains('canvas-element')) {
        selectElement(e.target);
    }
});

function selectElement(element) {
    if (selectedElement === element) return;
    if (selectedElement) deselectElement();

    selectedElement = element;
    element.classList.add('selected');
    addControls(element);
    highlightLayer(element);
    updatePropertiesPanel(element);
}

function deselectElement() {
    if (selectedElement) {
        selectedElement.classList.remove('selected');
        removeControls(selectedElement);
        highlightLayer(null);
        updatePropertiesPanel(null);
        selectedElement = null;
    }
}

function addControls(element) {
    const positions = ['tl', 'tr', 'bl', 'br'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.classList.add('resize-handle', `handle-${pos}`);
        handle.dataset.handle = pos;
        element.appendChild(handle);

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            initResize(e);
        });
    });

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    element.appendChild(rotateHandle);
    rotateHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        initRotate(e);
    });
}

function removeControls(element) {
    const resizers = element.querySelectorAll('.resize-handle');
    resizers.forEach(h => h.remove());
    const rotators = element.querySelectorAll('.rotate-handle');
    rotators.forEach(h => h.remove());
}

requestArea.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;

    if (currentTool === 'mouse-pointer-2' && e.target.classList.contains('canvas-element')) {
        initDrag(e);
        return;
    }

    if (currentTool === 'square' || currentTool === 'type') {
        initCreate(e);
    }
});

function initResize(e) {
    isResizing = true;
    resizeHandle = e.target.dataset.handle;

    startState = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: selectedElement.offsetWidth,
        height: selectedElement.offsetHeight,
        left: parseFloat(selectedElement.style.left),
        top: parseFloat(selectedElement.style.top),
        rotation: getRotation(selectedElement) * (Math.PI / 180)
    };

    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
}

function handleResize(e) {
    if (!isResizing) return;

    const gDx = e.clientX - startState.mouseX;
    const gDy = e.clientY - startState.mouseY;

    const sin = Math.sin(-startState.rotation);
    const cos = Math.cos(-startState.rotation);

    const lDx = gDx * cos - gDy * sin;
    const lDy = gDx * sin + gDy * cos;

    let dWidth = 0;
    let dHeight = 0;

    if (resizeHandle.includes('r')) dWidth = lDx;
    if (resizeHandle.includes('l')) dWidth = -lDx;
    if (resizeHandle.includes('b')) dHeight = lDy;
    if (resizeHandle.includes('t')) dHeight = -lDy;

    let newWidth = startState.width + dWidth;
    let newHeight = startState.height + dHeight;

    if (newWidth < 5) { newWidth = 5; dWidth = 5 - startState.width; }
    if (newHeight < 5) { newHeight = 5; dHeight = 5 - startState.height; }

    const lCenterShiftX = lDx / 2;
    const lCenterShiftY = lDy / 2;

    const sinR = Math.sin(startState.rotation);
    const cosR = Math.cos(startState.rotation);

    const gCenterShiftX = lCenterShiftX * cosR - lCenterShiftY * sinR;
    const gCenterShiftY = lCenterShiftX * sinR + lCenterShiftY * cosR;

    const startCenterX = startState.left + startState.width / 2;
    const startCenterY = startState.top + startState.height / 2;

    const newCenterX = startCenterX + gCenterShiftX;
    const newCenterY = startCenterY + gCenterShiftY;

    const newLeft = newCenterX - newWidth / 2;
    const newTop = newCenterY - newHeight / 2;

    selectedElement.style.width = `${newWidth}px`;
    selectedElement.style.height = `${newHeight}px`;
    selectedElement.style.left = `${newLeft}px`;
    selectedElement.style.top = `${newTop}px`;
    updatePropertiesPanel(selectedElement);
}

function stopResize() {
    isResizing = false;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
    saveData();
}

function initRotate(e) {
    isRotating = true;

    const rect = selectedElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    startState = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        rotation: getRotation(selectedElement),
        centerX: centerX,
        centerY: centerY,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
    };

    window.addEventListener('mousemove', handleRotate);
    window.addEventListener('mouseup', stopRotate);
}

function handleRotate(e) {
    if (!isRotating) return;

    const currentAngle = Math.atan2(e.clientY - startState.centerY, e.clientX - startState.centerX) * (180 / Math.PI);
    const rotationDelta = currentAngle - startState.startAngle;
    const newRotation = startState.rotation + rotationDelta;

    selectedElement.style.transform = `rotate(${newRotation}deg)`;
    selectedElement.dataset.rotation = newRotation;
}

function stopRotate() {
    isRotating = false;
    window.removeEventListener('mousemove', handleRotate);
    window.removeEventListener('mouseup', stopRotate);
    saveData();
}

function initDrag(e) {
    isDragging = true;
    const target = e.target;

    if (selectedElement !== target) {
        selectElement(target);
    }

    startState = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        left: parseFloat(selectedElement.style.left) || 0,
        top: parseFloat(selectedElement.style.top) || 0,
        width: selectedElement.offsetWidth,
        height: selectedElement.offsetHeight
    };

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!isDragging || !selectedElement) return;

    const deltaX = e.clientX - startState.mouseX;
    const deltaY = e.clientY - startState.mouseY;

    let newLeft = startState.left + deltaX;
    let newTop = startState.top + deltaY;

    const parentRect = requestArea.getBoundingClientRect();

    const maxLeft = parentRect.width - startState.width;
    const maxTop = parentRect.height - startState.height;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    selectedElement.style.left = `${newLeft}px`;
    selectedElement.style.top = `${newTop}px`;
    updatePropertiesPanel(selectedElement);
}

function stopDrag() {
    isDragging = false;
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', stopDrag);
    saveData();
}

function initCreate(e) {
    isDrawing = true;
    const parentRect = requestArea.getBoundingClientRect();

    startPos = {
        x: e.clientX - parentRect.left,
        y: e.clientY - parentRect.top
    };

    const element = document.createElement('div');
    element.id = 'rect-' + Date.now();
    element.style.top = `${startPos.y}px`;
    element.style.width = '0px';
    element.style.height = '0px';

    if (currentTool === 'type') {
        element.className = 'canvas-element element-text element-creating';
        element.dataset.type = 'text';
        element.dataset.name = 'Text ' + textCount++;
        element.textContent = 'Text';
        element.style.fontSize = '16px';
        element.style.color = '#ffffff';
    } else {
        element.className = 'canvas-element element-rectangle element-creating';
        element.dataset.type = 'rectangle';
        element.dataset.name = 'Element ' + elementCount++;
    }

    element.dataset.rotation = '0';

    requestArea.appendChild(element);
    currentElement = element;

    window.addEventListener('mousemove', handleCreate);
    window.addEventListener('mouseup', stopCreate);
}

function handleCreate(e) {
    if (!isDrawing || !currentElement) return;

    const parentRect = requestArea.getBoundingClientRect();
    const currentX = e.clientX - parentRect.left;
    const currentY = e.clientY - parentRect.top;

    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);
    const left = Math.min(startPos.x, currentX);
    const top = Math.min(startPos.y, currentY);

    currentElement.style.width = `${width}px`;
    currentElement.style.height = `${height}px`;
    currentElement.style.left = `${left}px`;
    currentElement.style.top = `${top}px`;
}

function stopCreate() {
    if (!isDrawing) return;

    isDrawing = false;
    window.removeEventListener('mousemove', handleCreate);
    window.removeEventListener('mouseup', stopCreate);

    if (currentElement) {
        currentElement.classList.remove('element-creating');
        const w = parseInt(currentElement.style.width);
        const h = parseInt(currentElement.style.height);

        if (w < 5 || h < 5) {
            currentElement.remove();
            currentElement = null;
        } else {
            currentTool = 'mouse-pointer-2';
            toolGroups.forEach(t => t.classList.remove('active'));
            const pointerTool = Array.from(toolGroups).find(t => t.querySelector('[data-lucide="mouse-pointer-2"]'));
            if (pointerTool) pointerTool.classList.add('active');
            followerImg.src = 'Assests/cursor.png';

            selectElement(currentElement);
            updateLayersPanel();
            saveData();
            currentElement = null;
        }
    }
}

function updateLayersPanel() {
    layersContainer.innerHTML = '';
    const elements = Array.from(requestArea.querySelectorAll('.canvas-element')).reverse();

    elements.forEach(el => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        if (el === selectedElement) item.classList.add('active');
        item.dataset.id = el.id;

        let iconName = 'square';
        if (el.dataset.type === 'circle') iconName = 'circle';

        const displayName = el.dataset.name || 'Rectangle';

        item.innerHTML = `
            <div class="layer-info">
                <i data-lucide="${iconName}" class="layer-icon"></i>
                <span class="layer-name">${displayName}</span>
            </div>
            <div class="layer-actions">
                <button class="layer-btn btn-up" title="Bring Forward">
                    <i data-lucide="chevron-up"></i>
                </button>
                <button class="layer-btn btn-down" title="Send Backward">
                    <i data-lucide="chevron-down"></i>
                </button>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.layer-btn')) return;
            selectElement(el);
        });

        const btnUp = item.querySelector('.btn-up');
        const btnDown = item.querySelector('.btn-down');

        btnUp.addEventListener('click', (e) => {
            e.stopPropagation();
            moveLayer(el, 'up');
        });

        btnDown.addEventListener('click', (e) => {
            e.stopPropagation();
            moveLayer(el, 'down');
        });

        layersContainer.appendChild(item);
    });

    lucide.createIcons();
}

function highlightLayer(element) {
    const items = layersContainer.querySelectorAll('.layer-item');
    items.forEach(item => item.classList.remove('active'));

    if (element) {
        const item = layersContainer.querySelector(`.layer-item[data-id="${element.id}"]`);
        if (item) item.classList.add('active');
    }
}

function moveLayer(element, direction) {
    if (direction === 'up') {
        const next = element.nextElementSibling;
        if (next && next.classList.contains('canvas-element')) {
            next.after(element);
        }
    } else if (direction === 'down') {
        const prev = element.previousElementSibling;
        if (prev && prev.classList.contains('canvas-element')) {
            prev.before(element);
        }
    }
    updateLayersPanel();
    saveData();
}

function updatePropertiesPanel(element) {
    if (!element) {
        propertiesPanel.style.display = 'none';
        return;
    }

    propertiesPanel.style.display = 'block';

    propInputs.width.value = parseInt(element.style.width);
    propInputs.height.value = parseInt(element.style.height);

    const computedStyle = getComputedStyle(element);

    const bgColor = rgbToHex(computedStyle.backgroundColor);
    propInputs.color.value = bgColor;
    propInputs.hex.textContent = bgColor;

    propInputs.radius.value = parseInt(computedStyle.borderRadius) || 0;

    if (element.dataset.type === 'text') {
        propInputs.textRow.classList.remove('hidden');
        propInputs.textStyleRow.classList.remove('hidden');

        propInputs.text.value = element.textContent;
        propInputs.fontSize.value = parseInt(element.style.fontSize) || 16;
        propInputs.textColor.value = rgbToHex(element.style.color || computedStyle.color);
    } else {
        propInputs.textRow.classList.add('hidden');
        propInputs.textStyleRow.classList.add('hidden');
    }

    if (element.dataset.type === 'frame') {
        framePanel.style.display = 'block';
    } else {
        framePanel.style.display = 'none';
    }
}

function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return '#ffffff';
    if (rgb.startsWith('#')) return rgb;
    const sep = rgb.indexOf(",") > -1 ? "," : " ";
    rgb = rgb.substr(4).split(")")[0].split(sep);
    let r = (+rgb[0]).toString(16),
        g = (+rgb[1]).toString(16),
        b = (+rgb[2]).toString(16);
    if (r.length == 1) r = "0" + r;
    if (g.length == 1) g = "0" + g;
    if (b.length == 1) b = "0" + b;
    return "#" + r + g + b;
}

propInputs.width.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.width = `${e.target.value}px`;
        saveData();
    }
});

propInputs.height.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.height = `${e.target.value}px`;
        saveData();
    }
});

propInputs.color.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.backgroundColor = e.target.value;
        propInputs.hex.textContent = e.target.value;
        saveData();
    }
});

propInputs.radius.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.borderRadius = `${e.target.value}px`;
        saveData();
    }
});

propInputs.text.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.innerText = e.target.value;
        saveData();
    }
});

propInputs.fontSize.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.fontSize = `${e.target.value}px`;
        saveData();
    }
});

propInputs.textColor.addEventListener('input', (e) => {
    if (selectedElement) {
        selectedElement.style.color = e.target.value;
        saveData();
    }
});

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    if (!selectedElement) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const elementToRemove = selectedElement;
        deselectElement();
        elementToRemove.remove();
        updateLayersPanel();
        saveData();
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        const step = 5;
        let left = parseFloat(selectedElement.style.left) || 0;
        let top = parseFloat(selectedElement.style.top) || 0;
        const width = selectedElement.offsetWidth;
        const height = selectedElement.offsetHeight;
        const parentRect = requestArea.getBoundingClientRect();

        if (e.key === 'ArrowLeft') left -= step;
        if (e.key === 'ArrowRight') left += step;
        if (e.key === 'ArrowUp') top -= step;
        if (e.key === 'ArrowDown') top += step;

        const maxLeft = parentRect.width - width;
        const maxTop = parentRect.height - height;

        left = Math.max(0, Math.min(left, maxLeft));
        top = Math.max(0, Math.min(top, maxTop));

        selectedElement.style.left = `${left}px`;
        selectedElement.style.top = `${top}px`;

        updatePropertiesPanel(selectedElement);
        saveData();
    }
});

if (framePresets.length > 0) {
    framePresets.forEach(btn => {
        btn.addEventListener('click', () => {
            const w = parseInt(btn.dataset.w);
            const h = parseInt(btn.dataset.h);
            const name = btn.dataset.name;

            if (selectedElement && selectedElement.dataset.type === 'frame') {
                selectedElement.style.width = `${w}px`;
                selectedElement.style.height = `${h}px`;
                updatePropertiesPanel(selectedElement);
                saveData();
            } else {
                createFramePreset(w, h, name);
            }
        });
    });
}

function createFramePreset(width, height, namePrefix) {
    const element = document.createElement('div');
    element.id = 'frame-' + Date.now();
    element.className = 'canvas-element element-frame';
    element.dataset.type = 'frame';
    element.dataset.name = `${namePrefix} ${elementCount++}`;

    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.left = '100px';
    element.style.top = '50px';
    element.style.backgroundColor = '#ffffff';
    element.style.position = 'absolute';

    requestArea.appendChild(element);

    selectElement(element);
    updateLayersPanel();

    const pointerTool = Array.from(toolGroups).find(t => t.querySelector('[data-lucide="mouse-pointer-2"]'));
    if (pointerTool) pointerTool.click();
    saveData();
}

function saveData() {
    const elements = [];
    const canvasElements = requestArea.querySelectorAll('.canvas-element');

    canvasElements.forEach(el => {
        const data = {
            type: el.dataset.type,
            name: el.dataset.name,
            id: el.id,
            style: {
                left: el.style.left,
                top: el.style.top,
                width: el.style.width,
                height: el.style.height,
                backgroundColor: el.style.backgroundColor,
                borderRadius: el.style.borderRadius,
                transform: el.style.transform,
                fontSize: el.style.fontSize,
                color: el.style.color,
                position: el.style.position
            },
            dataset: {
                rotation: el.dataset.rotation
            },
            textContent: el.dataset.type === 'text' ? el.innerText : ''
        };
        elements.push(data);
    });

    const appState = {
        elements: elements,
        elementCount: elementCount,
        textCount: textCount
    };

    localStorage.setItem('canvasData', JSON.stringify(appState));
}

function loadData() {
    const saved = localStorage.getItem('canvasData');
    if (!saved) return;

    try {
        const appState = JSON.parse(saved);

        elementCount = appState.elementCount || 1;
        textCount = appState.textCount || 1;

        const existingElements = requestArea.querySelectorAll('.canvas-element');
        existingElements.forEach(el => el.remove());

        currentElement = null;
        selectedElement = null;

        appState.elements.forEach(data => {
            const el = document.createElement('div');
            el.id = data.id || 'el-' + Date.now();

            if (data.type === 'rectangle') {
                el.className = 'canvas-element element-rectangle';
            } else if (data.type === 'text') {
                el.className = 'canvas-element element-text';
                el.innerText = data.textContent;
            } else if (data.type === 'frame') {
                el.className = 'canvas-element element-frame';
            } else {
                el.className = 'canvas-element';
            }

            el.dataset.type = data.type;
            el.dataset.name = data.name;
            el.dataset.rotation = data.dataset.rotation || '0';

            Object.assign(el.style, data.style);

            requestArea.appendChild(el);
        });

        updateLayersPanel();

    } catch (e) {
        console.error('Failed to load canvas data', e);
    }
}

window.addEventListener('DOMContentLoaded', loadData);

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const isHidden = exportPanel.style.display === 'none';

        if (isHidden) {
            exportPanel.style.display = 'block';
            framePanel.style.display = 'none';
            propertiesPanel.style.display = 'none';
        } else {
            exportPanel.style.display = 'none';
            updateRightSidebar();
        }
    });
}

if (btnExportJson) {
    btnExportJson.addEventListener('click', downloadJSON);
}

if (btnExportHtml) {
    btnExportHtml.addEventListener('click', downloadHTML);
}

function downloadJSON() {
    saveData();
    const saved = localStorage.getItem('canvasData');
    if (!saved) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(saved);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "design.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function downloadHTML() {
    const canvasElements = requestArea.querySelectorAll('.canvas-element');
    let elementsHTML = '';

    canvasElements.forEach(el => {
        let content = '';
        if (el.dataset.type === 'text') {
            content = el.innerText;
        }

        const styles = [
            `position: absolute`,
            `left: ${el.style.left}`,
            `top: ${el.style.top}`,
            `width: ${el.style.width}`,
            `height: ${el.style.height}`,
            `background-color: ${el.style.backgroundColor}`,
            `border-radius: ${el.style.borderRadius}`,
            `transform: ${el.style.transform}`,
            `font-size: ${el.style.fontSize}`,
            `color: ${el.style.color}`,
            `display: flex`,
            `align-items: center`,
            `justify-content: center`
        ].join('; ');

        elementsHTML += `<div style="${styles}">${content}</div>\n`;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Design</title>
    <style>
        body { margin: 0; background-color: #1e1e1e; font-family: sans-serif; overflow: hidden; }
        .canvas { position: relative; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div class="canvas">
${elementsHTML}
    </div>
</body>
</html>`;

    const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "design.html");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}