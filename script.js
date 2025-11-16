const BOARD_DIMENSION = 300;
const MIN_BOARD_SIZE = 2;
const MAX_BOARD_SIZE = 7;
const TARGET_PIXELS_PER_PIECE = 35000;
const IMAGE_PATH = 'image.png';

let puzzleState = null;

window.onload = () => {
    initPuzzle();
};

async function initPuzzle() {
    const tray = document.getElementById('puzzle-pieces-tray');
    const board = document.getElementById('puzzle-board');

    if (!tray || !board) {
        console.warn('Puzzle markup missing. Cannot start puzzle.');
        return;
    }

    const { statusNode, previewCanvas, previewCtx } = injectHelperPanel();
    setStatus('Loading image.png...');

    try {
        const sourceImage = await loadPuzzleImage(IMAGE_PATH);
        const boardSize = computeBoardSize(sourceImage);
        const totalPieces = boardSize * boardSize;
        const pieceSize = BOARD_DIMENSION / boardSize;
        const trayPieceSize = Math.max(40, Math.min(pieceSize - 8, 80));

        const slots = rebuildBoard(board, boardSize);
        const pieces = rebuildTray(tray, totalPieces);

        puzzleState = {
            tray,
            board,
            slots,
            pieces,
            boardSize,
            pieceSize,
            trayPieceSize,
            statusNode
        };

        const sceneCanvas = projectImageToCanvas(sourceImage, BOARD_DIMENSION);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.drawImage(sceneCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

        const textures = sliceScene(sceneCanvas, boardSize, pieceSize);
        hydratePieces(textures);
        enableDragAndDrop();
        shufflePieces();

        setStatus(
            `Image loaded from ${IMAGE_PATH} (${sourceImage.naturalWidth}×${sourceImage.naturalHeight}). Drag pieces to solve!`
        );
    } catch (error) {
        console.error('Failed to initialize puzzle', error);
        setStatus('Unable to load image.png. Please ensure the file is present.');
    }
}

function injectHelperPanel() {
    const existingPanel = document.getElementById('puzzle-helper-panel');
    if (existingPanel) {
        const canvas = existingPanel.querySelector('canvas');
        return {
            statusNode: existingPanel.querySelector('[data-role="status"]'),
            previewCanvas: canvas,
            previewCtx: canvas.getContext('2d')
        };
    }

    const container = document.querySelector('.puzzle-container');
    const helperPanel = document.createElement('div');
    helperPanel.id = 'puzzle-helper-panel';
    helperPanel.style.display = 'flex';
    helperPanel.style.flexDirection = 'column';
    helperPanel.style.gap = '12px';
    helperPanel.style.alignItems = 'center';
    helperPanel.style.padding = '10px';
    helperPanel.style.background = '#1f1f1f';
    helperPanel.style.borderRadius = '8px';
    helperPanel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';

    const heading = document.createElement('h2');
    heading.textContent = 'Preview';
    heading.style.margin = '0';
    heading.style.fontSize = '1.1rem';
    helperPanel.appendChild(heading);

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = BOARD_DIMENSION;
    previewCanvas.height = BOARD_DIMENSION;
    previewCanvas.style.width = '260px';
    previewCanvas.style.height = '260px';
    previewCanvas.style.border = '2px solid #444';
    previewCanvas.style.borderRadius = '6px';
    previewCanvas.style.background = '#050505';
    helperPanel.appendChild(previewCanvas);

    const statusNode = document.createElement('p');
    statusNode.style.margin = '0';
    statusNode.style.fontSize = '0.9rem';
    statusNode.style.textAlign = 'center';
    statusNode.style.color = '#d7d7d7';
    statusNode.dataset.role = 'status';
    helperPanel.appendChild(statusNode);

    if (container) {
        container.appendChild(helperPanel);
    } else {
        document.body.appendChild(helperPanel);
    }

    return {
        statusNode,
        previewCanvas,
        previewCtx: previewCanvas.getContext('2d')
    };
}

function loadPuzzleImage(path) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load ${path}`));
        image.src = path;
    });
}

function computeBoardSize(image) {
    const pixelCount = image.naturalWidth * image.naturalHeight;
    const base = Math.sqrt(pixelCount / TARGET_PIXELS_PER_PIECE);
    const boosted = base * 1.15;
    const approximatePiecesPerSide = Math.round(boosted);
    return clamp(
        approximatePiecesPerSide || MIN_BOARD_SIZE,
        MIN_BOARD_SIZE,
        MAX_BOARD_SIZE
    );
}

function projectImageToCanvas(image, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const offsetX = (size - drawWidth) / 2;
    const offsetY = (size - drawHeight) / 2;
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    return canvas;
}

function sliceScene(sceneCanvas, boardSize, pieceSize) {
    const slices = [];
    for (let row = 0; row < boardSize; row += 1) {
        for (let col = 0; col < boardSize; col += 1) {
            const pieceCanvas = document.createElement('canvas');
            pieceCanvas.width = pieceSize;
            pieceCanvas.height = pieceSize;
            const ctx = pieceCanvas.getContext('2d');
            ctx.drawImage(
                sceneCanvas,
                col * pieceSize,
                row * pieceSize,
                pieceSize,
                pieceSize,
                0,
                0,
                pieceSize,
                pieceSize
            );
            slices.push(pieceCanvas.toDataURL('image/png'));
        }
    }
    return slices;
}

function rebuildBoard(board, boardSize) {
    board.innerHTML = '';
    board.style.display = 'grid';
    board.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
    board.style.gridTemplateRows = `repeat(${boardSize}, 1fr)`;

    const slots = [];
    for (let i = 0; i < boardSize * boardSize; i += 1) {
        const slot = document.createElement('div');
        slot.className = 'puzzle-slot';
        slot.dataset.slotId = String(i + 1);
        board.appendChild(slot);
        slots.push(slot);
    }
    return slots;
}

function rebuildTray(tray, totalPieces) {
    tray.innerHTML = '';
    const pieces = [];
    for (let i = 0; i < totalPieces; i += 1) {
        const piece = document.createElement('div');
        piece.className = 'puzzle-piece';
        piece.dataset.pieceId = String(i + 1);
        tray.appendChild(piece);
        pieces.push(piece);
    }
    return pieces;
}

function hydratePieces(textures) {
    if (!puzzleState) {
        return;
    }
    puzzleState.pieces.forEach((piece, index) => {
        const texture = textures[index];
        piece.style.backgroundImage = `url(${texture})`;
        piece.style.backgroundSize = 'cover';
        piece.style.backgroundPosition = 'center';
        piece.dataset.correctSlot = String(index + 1);
        piece.setAttribute('draggable', 'true');
        applyTrayStyles(piece);
    });
}

function enableDragAndDrop() {
    if (!puzzleState) {
        return;
    }

    puzzleState.pieces.forEach(piece => {
        piece.addEventListener('dragstart', handleDragStart);
        piece.addEventListener('dragend', handleDragEnd);
    });

    puzzleState.slots.forEach(slot => {
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragenter', () => slot.classList.add('drag-over'));
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', handleDropOnSlot);
    });

    puzzleState.tray.addEventListener('dragover', handleDragOver);
    puzzleState.tray.addEventListener('drop', handleDropOnTray);
}

function handleDragStart(event) {
    const piece = event.currentTarget;
    event.dataTransfer.setData('text/plain', piece.dataset.pieceId);
    event.dataTransfer.effectAllowed = 'move';
    piece.classList.add('dragging');
}

function handleDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    document
        .querySelectorAll('.puzzle-slot.drag-over')
        .forEach(slot => slot.classList.remove('drag-over'));
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleDropOnSlot(event) {
    event.preventDefault();
    if (!puzzleState) {
        return;
    }

    const slot = event.currentTarget;
    const pieceId = event.dataTransfer.getData('text/plain');
    const piece = puzzleState.pieces.find(p => p.dataset.pieceId === pieceId);
    if (!piece) {
        return;
    }

    const occupyingPiece = slot.querySelector('.puzzle-piece');
    if (occupyingPiece && occupyingPiece !== piece) {
        movePieceToTray(occupyingPiece);
    }

    placePieceInSlot(piece, slot);
    slot.classList.remove('drag-over');
    setStatus('Piece placed on the board.');
    checkCompletion();
}

function handleDropOnTray(event) {
    event.preventDefault();
    const pieceId = event.dataTransfer.getData('text/plain');
    const piece = puzzleState?.pieces.find(p => p.dataset.pieceId === pieceId);
    if (!piece) {
        return;
    }
    movePieceToTray(piece);
    setStatus('Piece returned to the tray.');
    checkCompletion();
}

function placePieceInSlot(piece, slot) {
    const previousParent = piece.parentElement;
    if (previousParent && previousParent.classList.contains('puzzle-slot')) {
        previousParent.classList.remove('filled');
    }

    slot.appendChild(piece);
    slot.classList.add('filled');
    applySlotStyles(piece);
    piece.dataset.placedSlot = slot.dataset.slotId;
}

function movePieceToTray(piece) {
    if (!puzzleState) {
        return;
    }
    const parentSlot = piece.parentElement;
    if (parentSlot && parentSlot.classList.contains('puzzle-slot')) {
        parentSlot.classList.remove('filled', 'drag-over');
    }
    puzzleState.tray.appendChild(piece);
    applyTrayStyles(piece);
    piece.dataset.placedSlot = '';
}

function applyTrayStyles(piece) {
    if (!puzzleState) {
        return;
    }
    piece.style.width = `${puzzleState.trayPieceSize}px`;
    piece.style.height = `${puzzleState.trayPieceSize}px`;
    piece.style.position = 'static';
    piece.style.margin = '';
    piece.style.border = '1px solid #0056b3';
    piece.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.4)';
}

function applySlotStyles(piece) {
    piece.style.width = '100%';
    piece.style.height = '100%';
    piece.style.position = 'relative';
    piece.style.margin = '0';
    piece.style.border = 'none';
    piece.style.boxShadow = 'none';
}

function shufflePieces() {
    if (!puzzleState) {
        return;
    }
    puzzleState.slots.forEach(slot => {
        const occupant = slot.querySelector('.puzzle-piece');
        if (occupant) {
            movePieceToTray(occupant);
        }
        slot.classList.remove('filled', 'drag-over');
    });

    const shuffled = [...puzzleState.pieces];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach(piece => {
        puzzleState.tray.appendChild(piece);
        applyTrayStyles(piece);
    });

    setStatus('Pieces shuffled. Start solving!');
}

function checkCompletion() {
    if (!puzzleState) {
        return;
    }
    const { slots } = puzzleState;
    const allFilled = slots.every(slot => slot.querySelector('.puzzle-piece'));
    const allCorrect = slots.every(slot => {
        const piece = slot.querySelector('.puzzle-piece');
        return piece && piece.dataset.correctSlot === slot.dataset.slotId;
    });

    if (allCorrect && allFilled) {
        setStatus('Puzzle completed! Great work!');
    } else if (allFilled) {
        setStatus('So close! Some pieces need to be swapped.');
    }
}

function setStatus(message) {
    if (puzzleState?.statusNode) {
        puzzleState.statusNode.textContent = message;
    }
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
