// Global variables
let notes = [];
let keyStrokeCount = 0;
const AUTOSAVE_THRESHOLD = 10; // Save after 10 keystrokes
let lastMousePosition = { x: 0, y: 0 };
let selectedNoteId = null;
let historyStack = [];
let currentHistoryIndex = -1;
const MAX_HISTORY_LENGTH = 50;  // Maximum number of history states to keep
let lastDeletePressTime = 0;
const DOUBLE_DELETE_THRESHOLD = 300; // Time in milliseconds for double-delete
let lastColorClass = 'color-3'; // Default to yellow (color-3)
let cursorElement = null;
const NOTE_SIZE = 150; // Size of notes in pixels (both width and height)
const NOTE_HALF_SIZE = NOTE_SIZE / 2; // Half size for centering calculations

// Define area boundaries - add this with the other global variables
const dropArea = {
    active: true,
    element: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    createDropArea(); // Create the bounded area
    addInfoButton(); // Add the info button to the footer
    setupCustomCursor(); // Set up the custom cursor
    setupColorSelectors(); // Set up color selector circles
    
    // Make sure drop area bounds are updated once page is fully loaded
    window.addEventListener('load', () => {
        updateDropAreaBounds();
        // After bounds are updated, update note positions
        updateNotesOnResize();
    });
    
    // Update note positions when window is resized
    window.addEventListener('resize', () => {
        updateDropAreaBounds();
        // Add a slight delay to ensure bounds are updated first
        setTimeout(updateNotesOnResize, 50);
    });
    
    // Track mouse position for 'N' key note creation
    document.addEventListener('mousemove', (e) => {
        lastMousePosition.x = e.clientX;
        lastMousePosition.y = e.clientY;
    });
    
    // Event listener for creating new notes with 'N' key and number keys
    document.addEventListener('keydown', (e) => {
        // Create note with random color when pressing 'N'
        if (e.key.toLowerCase() === 'n' && !isEditingNote()) {
            createNote(
                lastMousePosition.x,
                lastMousePosition.y,
                null // null means random color
            );
        }
        
        // When pressing number keys 1-5, ONLY update the selected color (don't create a note)
        if (['1', '2', '3', '4', '5'].includes(e.key) && !isEditingNote()) {
            const colorClass = `color-${e.key}`;
            // Update the last color class
            lastColorClass = colorClass;
            
            // Update the selected color circle to match
            updateSelectedColorCircle(colorClass);
            
            // Update cursor color
            if (cursorElement) {
                cursorElement.style.backgroundColor = getColorFromClass(colorClass);
            }
            
            console.log(`Color changed to: ${colorClass}`);
        }
        
        // Handle delete/backspace for selected notes - updated for double-delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const now = Date.now();
            
            // If there's a selected note and we're in a textarea
            if (selectedNoteId && isEditingNote()) {
                // Check if this is a double-press
                if (now - lastDeletePressTime < DOUBLE_DELETE_THRESHOLD) {
                    // Double delete detected! Delete the whole note.
                    console.log('Double-delete detected, deleting note:', selectedNoteId);
                    deleteNote(selectedNoteId);
                    e.preventDefault();
                    
                    // Reset the timer
                    lastDeletePressTime = 0;
                } else {
                    // First delete press, just update the timer
                    lastDeletePressTime = now;
                    
                    // Let the normal delete behavior continue (editing text)
                }
            } else if (selectedNoteId && !isEditingNote()) {
                // Standard delete behavior when not editing text
                console.log('Deleting note:', selectedNoteId);
                deleteNote(selectedNoteId);
                e.preventDefault();
            }
        }
        
        // Handle undo with Ctrl+Z
        if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !isEditingNote()) {
            e.preventDefault();
            undo();
        }
    });
    
    // Event listener for creating new notes by clicking on empty space
    document.getElementById('notes-container').addEventListener('click', (e) => {
        // Allow clicks on notes-container OR drop-area to create new notes
        if (e.target.id === 'notes-container' || e.target.id === 'drop-area') {
            // Use the lastColorClass rather than null (which triggers random color)
            createNote(e.clientX, e.clientY, lastColorClass);
        }
    });
});

// Set up color selectors functionality
function setupColorSelectors() {
    const colorCircles = document.querySelectorAll('.color-circle');
    
    // Mark the default selected color
    updateSelectedColorCircle(lastColorClass);
    
    // Add click events to each color circle
    colorCircles.forEach(circle => {
        circle.addEventListener('click', function() {
            // Update lastColorClass
            const colorNumber = this.getAttribute('data-color');
            lastColorClass = `color-${colorNumber}`;
            
            // Update selected circle UI
            updateSelectedColorCircle(lastColorClass);
            
            // Update cursor color
            if (cursorElement) {
                cursorElement.style.backgroundColor = getColorFromClass(lastColorClass);
            }
            
            // Visual feedback
            circle.style.transform = 'scale(1.2)';
            setTimeout(() => {
                circle.style.transform = '';
            }, 200);
        });
    });
}

// Function to update the selected color circle
function updateSelectedColorCircle(colorClass) {
    const colorCircles = document.querySelectorAll('.color-circle');
    
    // Remove selected class from all circles
    colorCircles.forEach(c => c.classList.remove('selected'));
    
    // Add selected class to the matching circle
    const selectedCircle = document.querySelector(`.color-circle.${colorClass}`);
    if (selectedCircle) {
        selectedCircle.classList.add('selected');
    }
}

// Check if user is currently editing a note
function isEditingNote() {
    const activeElement = document.activeElement;
    const isTextarea = activeElement.classList.contains('note-content');
    console.log('Is editing note:', isTextarea); // Debug log
    return isTextarea;
}

// Load notes from localStorage
function loadNotes() {
    const savedNotes = localStorage.getItem('postItNotes');
    if (savedNotes) {
        notes = JSON.parse(savedNotes);
        notes.forEach(note => {
            createNoteElement(note);
        });
    }
}

// Save notes to localStorage
function saveNotes(addToHistory = true) {
    localStorage.setItem('postItNotes', JSON.stringify(notes));
    console.log('Notes saved!');
}

// Create a new note
function createNote(x, y, colorClass = null) {
    // Get container dimensions
    const containerRect = document.getElementById('notes-container').getBoundingClientRect();
    
    // Convert viewport coordinates to be relative to the container
    const relX = x - containerRect.left;
    const relY = y - containerRect.top;
    
    // Center the note on cursor position (using half of the note size)
    const centeredX = relX - NOTE_HALF_SIZE;
    const centeredY = relY - NOTE_HALF_SIZE;
    
    // Ensure within bounds (check before creating)
    let adjustedX = centeredX;
    let adjustedY = centeredY;
    
    if (dropArea.active) {
        // Simple bounds check using note size
        if (adjustedX < 0) adjustedX = 0;
        if (adjustedX > dropArea.width - NOTE_SIZE) adjustedX = dropArea.width - NOTE_SIZE;
        if (adjustedY < 0) adjustedY = 0;
        if (adjustedY > dropArea.height - NOTE_SIZE) adjustedY = dropArea.height - NOTE_SIZE;
    }
    
    console.log('Creating note at:', { 
        clickX: x, 
        clickY: y, 
        containerPos: { left: containerRect.left, top: containerRect.top }, 
        relativePos: { x: relX, y: relY },
        centeredPos: { x: centeredX, y: centeredY },
        dropAreaDimensions: { width: dropArea.width, height: dropArea.height },
        adjustedPos: { x: adjustedX, y: adjustedY } 
    });
    
    // Generate a random color if null is provided (pressing 'N')
    if (!colorClass) {
        colorClass = `color-${Math.floor(Math.random() * 5) + 1}`;
        console.log(`New random color selected: ${colorClass}`);
    }
    
    // Always update the last color class used to match the note's color
    lastColorClass = colorClass;
    
    // Update the UI to show which color is currently selected
    updateSelectedColorCircle(lastColorClass);
    
    // Also update cursor color
    if (cursorElement) {
        cursorElement.style.backgroundColor = getColorFromClass(colorClass);
    }
    
    // Save current state to history before creating new note
    saveToHistory('create', { x: adjustedX, y: adjustedY, colorClass });
    
    const noteId = Date.now().toString();
    
    // Calculate percentage position relative to drop area
    // For relative positions within the container, use the container width/height
    const xPercent = dropArea.width ? (adjustedX / dropArea.width) * 100 : 0;
    const yPercent = dropArea.height ? (adjustedY / dropArea.height) * 100 : 0;
    
    const note = {
        id: noteId,
        content: '',
        x: adjustedX,
        y: adjustedY,
        xPercent: xPercent,   // Store position as percentage of container width
        yPercent: yPercent,   // Store position as percentage of container height
        colorClass: colorClass,
        zIndex: getHighestZIndex() + 1
    };
    
    notes.push(note);
    
    // Set a flag to prevent additional history entries during initialization
    note._skipHistoryForInitialEvents = true;
    
    createNoteElement(note);
    
    // Now that the note is created, save notes to localStorage (without adding another history entry)
    saveNotes(false); // Skip adding to history since we already did
    
    // Clear the flag after a moment
    setTimeout(() => {
        if (note && notes.includes(note)) {
            delete note._skipHistoryForInitialEvents;
        }
    }, 100);
    
    return note;
}

// Get the highest z-index currently in use
function getHighestZIndex() {
    const notesElements = document.querySelectorAll('.note');
    let maxZ = 0;
    
    notesElements.forEach(noteEl => {
        const z = parseInt(noteEl.style.zIndex || 0);
        if (z > maxZ) maxZ = z;
    });
    
    return maxZ;
}

// Create a DOM element for a note
function createNoteElement(note) {
    // If we have percentage values and valid drop area dimensions, calculate pixel positions
    if (note.xPercent !== undefined && note.yPercent !== undefined && dropArea.width && dropArea.height) {
        note.x = (note.xPercent / 100) * dropArea.width;
        note.y = (note.yPercent / 100) * dropArea.height;
    }
    
    const noteElement = document.createElement('div');
    noteElement.className = `note ${note.colorClass}`;
    noteElement.id = note.id;
    noteElement.style.left = `${note.x}px`;
    noteElement.style.top = `${note.y}px`;
    noteElement.style.zIndex = note.zIndex || getHighestZIndex() + 1;
    
    // Add transition for smooth repositioning during resize
    noteElement.style.transition = 'left 0.2s ease, top 0.2s ease';
    
    // Set size using the constant
    noteElement.style.width = `${NOTE_SIZE}px`;
    noteElement.style.minHeight = `${NOTE_SIZE}px`;
    
    // Create header for dragging with improved sticky appearance
    const header = document.createElement('div');
    header.className = 'note-header';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'note-content';
    textarea.value = note.content || '';
    textarea.placeholder = 'Write your note here...';
    
    noteElement.appendChild(header);
    noteElement.appendChild(textarea);
    document.getElementById('notes-container').appendChild(noteElement);
    
    // Make the entire note draggable except for the textarea
    makeDraggable(noteElement, null, textarea);
    
    // Ensure the textarea can be edited
    textarea.addEventListener('click', (e) => {
        e.stopPropagation();
        bringToFront(noteElement);
    });
    
    // Add event listeners for content changes
    textarea.addEventListener('input', (e) => {
        updateNoteContent(note.id, e.target.value);
        resizeTextToFit(textarea);
        keyStrokeCount++;
        
        if (keyStrokeCount >= AUTOSAVE_THRESHOLD) {
            saveNotes();
            keyStrokeCount = 0;
        }
    });
    
    // Add this focus event listener
    textarea.addEventListener('focus', () => {
        // Select this note when its textarea receives focus
        selectNote(noteElement);
    });
    
    // Save when focus is lost
    textarea.addEventListener('blur', () => {
        saveNotes();
        keyStrokeCount = 0;
    });
    
    // Bring note to front when clicking on it
    noteElement.addEventListener('mousedown', () => {
        bringToFront(noteElement);
    });

    // Add this inside the function after the other event listeners
    noteElement.addEventListener('click', () => {
        selectNote(noteElement);
    });

    // Add this to the createNoteElement function to set initial text size
    resizeTextToFit(textarea);
}

// Update note content in the notes array
function updateNoteContent(id, content) {
    const note = notes.find(note => note.id === id);
    if (note) {
        // Only save to history if content actually changed and we're not in initialization phase
        if (note.content !== content && !note._skipHistoryForInitialEvents) {
            saveToHistory('edit', { 
                id: id, 
                previousContent: note.content,
                newContent: content
            });
        }
        
        note.content = content;
    }
}

// Update note position in the notes array
function updateNotePosition(id, x, y) {
    const note = notes.find(note => note.id === id);
    if (note) {
        // Update absolute pixel positions
        note.x = x;
        note.y = y;
        
        // Update percentage positions for responsive layout
        if (dropArea.width && dropArea.height) {
            note.xPercent = (x / dropArea.width) * 100;
            note.yPercent = (y / dropArea.height) * 100;
        }
        
        // We now save position changes to history again
        // No need to add code here as saving to history is handled in closeDragElement
    }
}

// Update note's z-index in the array
function updateNoteZIndex(id, zIndex) {
    const note = notes.find(note => note.id === id);
    if (note) {
        note.zIndex = zIndex;
    }
}

// Make an element draggable by a handle
function makeDraggable(element, handle, excludeElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let initialLeft, initialTop; // Store initial position
    
    if (handle) {
        // If a handle is specified, make only the handle trigger dragging
        handle.onmousedown = dragMouseDown;
        handle.ontouchstart = dragTouchStart;
    } else {
        // Otherwise, make the entire element draggable
        element.onmousedown = dragMouseDown;
        element.ontouchstart = dragTouchStart;
    }
    
    function dragMouseDown(e) {
        // Check if we're clicking on the excluded element (textarea)
        if (excludeElement && (e.target === excludeElement || excludeElement.contains(e.target))) {
            return; // Don't start dragging
        }
        
        e.preventDefault();
        // Get the mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        // Store initial position for history
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        
        // Bring the note to the front
        bringToFront(element);
        
        // Disable transitions during dragging for responsiveness
        element.style.transition = 'none';
    }
    
    function dragTouchStart(e) {
        // Check if we're touching the excluded element (textarea)
        if (excludeElement && (e.target === excludeElement || excludeElement.contains(e.target))) {
            return; // Don't start dragging
        }
        
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        
        // Store initial position for history
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        
        document.ontouchend = closeTouchDragElement;
        document.ontouchmove = elementTouchDrag;
        
        // Bring the note to the front
        bringToFront(element);
        
        // Disable transitions during dragging for responsiveness
        element.style.transition = 'none';
    }
    
    function elementDrag(e) {
        e.preventDefault();
        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        
        // Optional: Apply bounds constraint during dragging for smoother experience
        // keepNoteInBounds(element);
    }
    
    function elementTouchDrag(e) {
        e.preventDefault();
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        
        // Optional: Apply bounds constraint during dragging for smoother experience
        // keepNoteInBounds(element);
    }
    
    function closeDragElement() {
        // Re-enable transitions after dragging
        element.style.transition = 'left 0.2s ease, top 0.2s ease';
        
        // Ensure the note stays within bounds and get the corrected position
        const correctedPosition = keepNoteInBounds(element);
        
        // Use corrected position
        const x = correctedPosition ? correctedPosition.x : parseInt(element.style.left);
        const y = correctedPosition ? correctedPosition.y : parseInt(element.style.top);
        
        // Only save to history if the position actually changed significantly
        if (Math.abs(initialLeft - x) > 5 || Math.abs(initialTop - y) > 5) {
            // Save to history
            saveToHistory('move', { 
                id: element.id, 
                prevX: initialLeft,
                prevY: initialTop,
                newX: x,
                newY: y
            });
        }
        
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
        
        // Save the new position
        updateNotePosition(
            element.id,
            x,
            y
        );
        saveNotes(false); // Save to localStorage but don't add to history since we already did
    }
    
    function closeTouchDragElement() {
        // Re-enable transitions after dragging
        element.style.transition = 'left 0.2s ease, top 0.2s ease';
        
        // Ensure the note stays within bounds and get the corrected position
        const correctedPosition = keepNoteInBounds(element);
        
        // Use corrected position
        const x = correctedPosition ? correctedPosition.x : parseInt(element.style.left);
        const y = correctedPosition ? correctedPosition.y : parseInt(element.style.top);
        
        // Only save to history if the position actually changed significantly
        if (Math.abs(initialLeft - x) > 5 || Math.abs(initialTop - y) > 5) {
            // Save to history
            saveToHistory('move', { 
                id: element.id, 
                prevX: initialLeft,
                prevY: initialTop,
                newX: x,
                newY: y
            });
        }
        
        // Stop moving when touch ends
        document.ontouchend = null;
        document.ontouchmove = null;
        
        // Save the new position
        updateNotePosition(
            element.id,
            x,
            y
        );
        saveNotes(false); // Save to localStorage but don't add to history since we already did
    }
}

// Bring a note to the front
function bringToFront(element) {
    const newZIndex = getHighestZIndex() + 1;
    element.style.zIndex = newZIndex;
    updateNoteZIndex(element.id, newZIndex);
}

// Update the selectNote function to focus the textarea automatically
function selectNote(noteElement) {
    // Check if we're in the middle of an undo operation
    const isUndoing = historyStack[currentHistoryIndex] && 
                     historyStack[currentHistoryIndex].actionType === 'create' && 
                     Date.now() - historyStack[currentHistoryIndex].timestamp < 500;
                     
    // Deselect previously selected note
    if (selectedNoteId) {
        const prevSelected = document.getElementById(selectedNoteId);
        if (prevSelected) {
            prevSelected.classList.remove('selected-note');
        }
    }
    
    // Select the new note
    selectedNoteId = noteElement.id;
    console.log('Selected note:', selectedNoteId); // Debug log
    noteElement.classList.add('selected-note');
    
    // Automatically focus the textarea of the selected note, unless we're undoing
    if (!isUndoing) {
        const textarea = noteElement.querySelector('.note-content');
        if (textarea) {
            // Use setTimeout to ensure the focus happens after the click event is fully processed
            setTimeout(() => {
                textarea.focus();
            }, 0);
        }
    }
}

// Add a function to delete a note
function deleteNote(id) {
    console.log('Delete function called for note ID:', id); // Debug log
    
    // Find the note to be deleted
    const noteToDelete = notes.find(note => note.id === id);
    
    // Check if note exists before proceeding
    if (!noteToDelete) {
        console.log('Note not found:', id);
        return;
    }
    
    // Save current state to history before deleting
    saveToHistory('delete', { note: noteToDelete });
    
    // Remove from DOM
    const noteElement = document.getElementById(id);
    if (noteElement) {
        noteElement.remove();
    } else {
        console.log('DOM element not found for note ID:', id);
    }
    
    // Remove from notes array
    notes = notes.filter(note => note.id !== id);
    console.log('Notes after deletion:', notes.length);
    
    // Clear selected note
    selectedNoteId = null;
    
    // Save changes
    saveNotes(false); // Skip adding to history since we already did
}

// Add this function to save the current state to history
function saveToHistory(actionType, details) {
    console.log(`Saving to history: ${actionType}`, details);
    
    // If we've gone back in history and then make a new change,
    // discard any future states
    if (currentHistoryIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, currentHistoryIndex + 1);
    }
    
    // Create a deep copy of the current notes array
    const notesCopy = JSON.parse(JSON.stringify(notes));
    
    // Push the current state to history
    historyStack.push({
        notes: notesCopy,
        actionType: actionType,
        details: details,
        timestamp: Date.now() // Add timestamp for debugging
    });
    
    // Limit history length
    if (historyStack.length > MAX_HISTORY_LENGTH) {
        historyStack.shift();
    }
    
    // Update current index
    currentHistoryIndex = historyStack.length - 1;
    console.log(`History updated. Current index: ${currentHistoryIndex}, Total entries: ${historyStack.length}`);
}

// Add this function to perform the undo action
function undo() {
    if (currentHistoryIndex <= 0) {
        console.log('Nothing to undo');
        return;
    }
    
    // Log all history entries for debugging
    console.log('Current history stack:');
    historyStack.forEach((entry, index) => {
        console.log(`${index}: ${entry.actionType} at ${new Date(entry.timestamp).toLocaleTimeString()}`);
    });
    
    // Get the current state before undoing
    const currentState = historyStack[currentHistoryIndex];
    console.log(`Currently at index ${currentHistoryIndex}: ${currentState.actionType}`);
    
    // Move back one step in history
    currentHistoryIndex--;
    
    // Get the previous state
    const previousState = historyStack[currentHistoryIndex];
    
    // Apply the previous state
    restoreFromState(previousState);
    
    console.log(`Undid action: ${currentState.actionType}. Now at index ${currentHistoryIndex}: ${previousState.actionType}`);
}

// Add this function to restore a previous state
function restoreFromState(state) {
    // Store the drop area reference temporarily
    const dropAreaElement = dropArea.element;
    
    // Check if we're undoing a simple move operation
    if (currentHistoryIndex >= 0 && 
        historyStack[currentHistoryIndex + 1] && 
        historyStack[currentHistoryIndex + 1].actionType === 'move') {
        
        // For move operations, we can just update the specific note without rebuilding everything
        const moveDetails = historyStack[currentHistoryIndex + 1].details;
        const noteElement = document.getElementById(moveDetails.id);
        
        if (noteElement) {
            // Set the position back to the previous state
            noteElement.style.left = `${moveDetails.prevX}px`;
            noteElement.style.top = `${moveDetails.prevY}px`;
            
            // Update the note data
            const note = notes.find(n => n.id === moveDetails.id);
            if (note) {
                note.x = moveDetails.prevX;
                note.y = moveDetails.prevY;
                
                // Update percentage values for responsive layout
                if (dropArea.width && dropArea.height) {
                    note.xPercent = (moveDetails.prevX / dropArea.width) * 100;
                    note.yPercent = (moveDetails.prevY / dropArea.height) * 100;
                }
            }
            
            // Save changes to localStorage
            saveNotes(false);
            return; // Exit early, no need to rebuild everything
        }
    }
    
    // For other action types, restore the entire state
    
    // Clear current notes from DOM
    const notesContainer = document.getElementById('notes-container');
    notesContainer.innerHTML = '';
    
    // First, recreate the drop area
    createDropArea();
    
    // Restore notes from the state
    notes = JSON.parse(JSON.stringify(state.notes));
    
    // Make sure any notes loaded from history have percentage values
    notes.forEach(note => {
        // Add percentage positions if missing (for compatibility with old saved states)
        if (note.xPercent === undefined && dropArea.width) {
            note.xPercent = (note.x / dropArea.width) * 100;
        }
        if (note.yPercent === undefined && dropArea.height) {
            note.yPercent = (note.y / dropArea.height) * 100;
        }
    });
    
    // Recreate all notes in the DOM
    notes.forEach(note => {
        createNoteElement(note);
    });
    
    // No note should be selected after an undo
    selectedNoteId = null;
    
    // Save to local storage
    saveNotes(false); // false means don't add to history
    
    // Make sure the drop area bounds are updated
    setTimeout(updateDropAreaBounds, 0);
}

// Updated function to prevent typing when at the limit
function resizeTextToFit(textarea) {
    const MIN_FONT_SIZE = 12; // Updated from 10 to 12
    const DEFAULT_FONT_SIZE = 14; // Default font size
    const content = textarea.value;
    const noteElement = textarea.parentElement;
    
    // Reset to default size to measure properly
    textarea.style.fontSize = `${DEFAULT_FONT_SIZE}px`;
    
    // If no content, just return
    if (!content) return;
    
    // Get the current scroll height and actual height
    const scrollHeight = textarea.scrollHeight;
    const visibleHeight = textarea.clientHeight;
    
    // If text fits, nothing to do
    if (scrollHeight <= visibleHeight) {
        // We're under the limit - make sure any previous input block is removed
        if (textarea.hasAttribute('data-at-limit')) {
            textarea.removeAttribute('data-at-limit');
        }
        return;
    }
    
    // Text doesn't fit, try to reduce font size
    let currentSize = DEFAULT_FONT_SIZE;
    
    // Gradually reduce font size until text fits or minimum size is reached
    while (textarea.scrollHeight > textarea.clientHeight && currentSize > MIN_FONT_SIZE) {
        currentSize -= 0.5;
        textarea.style.fontSize = `${currentSize}px`;
    }
    
    // If we hit the minimum size and text still doesn't fit
    if (textarea.scrollHeight > textarea.clientHeight && currentSize <= MIN_FONT_SIZE) {
        // If this is new text that doesn't fit, revert the last character
        if (!textarea.hasAttribute('data-at-limit')) {
            // Remove the last character that was typed
            textarea.value = content.slice(0, -1);
            
            // Update the note content after reverting
            const noteId = noteElement.id;
            updateNoteContent(noteId, textarea.value);
            
            // Mark this textarea as being at its limit
            textarea.setAttribute('data-at-limit', 'true');
            
            // Apply the shake effect to indicate the limit
            shakeNote(noteElement);
            
            // Set up an input event handler to block non-delete inputs
            setupInputBlocker(textarea);
        }
    }
}

// Function to temporarily block input except for delete/backspace
function setupInputBlocker(textarea) {
    // Add a one-time input event handler that will fire before our regular handlers
    textarea.addEventListener('beforeinput', function blockNonDeleteInput(e) {
        // Allow delete/backspace operations
        if (e.inputType === 'deleteContentBackward' || 
            e.inputType === 'deleteContentForward' || 
            e.inputType === 'deleteWordBackward' || 
            e.inputType === 'deleteWordForward' ||
            e.inputType === 'deleteByCut') {
            
            // If a delete operation, remove the limit flag to allow typing again
            // after the user has deleted some content
            textarea.removeAttribute('data-at-limit');
            
            // Remove this event listener once content is deleted
            textarea.removeEventListener('beforeinput', blockNonDeleteInput);
            return;
        }
        
        // Block all other input types when at the limit
        if (textarea.hasAttribute('data-at-limit')) {
            e.preventDefault();
            shakeNote(textarea.parentElement);
        }
    });
}

// Add this function to create a shake effect
function shakeNote(noteElement) {
    // Remove the class if it's already there
    noteElement.classList.remove('shake-effect');
    
    // Trigger reflow
    void noteElement.offsetWidth;
    
    // Add the class again to restart the animation
    noteElement.classList.add('shake-effect');
    
    // Remove the class after animation completes
    setTimeout(() => {
        noteElement.classList.remove('shake-effect');
    }, 500);
}

// Update this function to create an even larger drop area
function createDropArea() {
    // Clear any existing drop area first
    const existingArea = document.getElementById('drop-area');
    if (existingArea) {
        existingArea.remove();
    }
    
    // Create a visible drop area
    const dropAreaElement = document.createElement('div');
    dropAreaElement.id = 'drop-area';
    
    // CSS positioning directly in JavaScript for consistency
    dropAreaElement.style.position = 'absolute';
    dropAreaElement.style.left = '0';
    dropAreaElement.style.top = '0';
    dropAreaElement.style.width = '100%';
    dropAreaElement.style.height = '100%';
    dropAreaElement.style.margin = '0';
    dropAreaElement.style.padding = '0';
    dropAreaElement.style.boxSizing = 'border-box';
    
    // Visual styling
    dropAreaElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'; // Very light, almost white
    dropAreaElement.style.border = 'none'; // Remove the dashed border
    dropAreaElement.style.borderRadius = '8px';
    dropAreaElement.style.zIndex = '0'; // Below the notes
    
    // Add to page
    const container = document.getElementById('notes-container');
    container.appendChild(dropAreaElement);
    
    // Store reference
    dropArea.element = dropAreaElement;
    dropArea.active = true;
    
    // Force layout recalculation
    container.offsetHeight;
    
    // Update bounds immediately
    updateDropAreaBounds();
    
    console.log('Drop area created and initialized');
    
    // Update bounds when window resizes
    window.addEventListener('resize', updateDropAreaBounds);
    
    // Also update on window load to ensure bounds are correct after all assets load
    window.addEventListener('load', () => {
        console.log('Window loaded - updating drop area bounds');
        updateDropAreaBounds();
    });
}

// Update drop area dimensions
function updateDropAreaBounds() {
    if (!dropArea.element) {
        console.log('Drop area element not found');
        return;
    }
    
    // Get the element's position relative to the viewport
    const rect = dropArea.element.getBoundingClientRect();
    
    // Get the position of the container for reference
    const container = document.getElementById('notes-container');
    const containerRect = container.getBoundingClientRect();
    
    // Store the dimensions
    dropArea.x = rect.left;
    dropArea.y = rect.top;
    dropArea.width = rect.width;
    dropArea.height = rect.height;
    
    // Calculate offsets from the container
    const offsetX = rect.left - containerRect.left;
    const offsetY = rect.top - containerRect.top;
    
    // Store more detailed info for debugging
    console.log('Drop area bounds updated:', {
        dropArea: {
            x: dropArea.x,
            y: dropArea.y,
            width: dropArea.width,
            height: dropArea.height,
            active: dropArea.active
        },
        container: {
            left: containerRect.left,
            top: containerRect.top,
            width: containerRect.width,
            height: containerRect.height
        },
        offset: { x: offsetX, y: offsetY },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    });
}

// Ensure notes stay within bounds
function keepNoteInBounds(noteElement) {
    if (!dropArea.active) return;
    
    // Use the defined note size rather than calculating from getBoundingClientRect
    // This is more reliable as it's consistent with our other code
    const noteWidth = NOTE_SIZE;
    const noteHeight = NOTE_SIZE;
    
    let x = parseInt(noteElement.style.left);
    let y = parseInt(noteElement.style.top);
    
    // Calculate bounds relative to the container
    // Note positions are relative to the container, so minX and minY are 0
    const minX = 0;
    const maxX = dropArea.width - noteWidth;
    const minY = 0;
    const maxY = dropArea.height - noteHeight;
    
    // Adjust position if out of bounds
    if (x < minX) x = minX;
    if (x > maxX) x = maxX;
    if (y < minY) y = minY;
    if (y > maxY) y = maxY;
    
    // Apply corrected position
    noteElement.style.left = `${x}px`;
    noteElement.style.top = `${y}px`;
    
    console.log('Note kept in bounds:', { 
        x, y, 
        minX, maxX, minY, maxY,
        noteSize: { width: noteWidth, height: noteHeight }
    });
    
    return { x, y };
}

// Update the addInfoButton function to match the new styling requirements
function addInfoButton() {
    // Get the footer element
    const footer = document.querySelector('footer');
    
    // Create the info button container
    const infoContainer = document.createElement('div');
    infoContainer.style.position = 'relative';
    infoContainer.style.display = 'inline-block';
    infoContainer.style.marginLeft = '8px';
    infoContainer.style.verticalAlign = 'middle';
    infoContainer.style.transform = 'scale(0.8)'; // Make it 20% smaller
    
    // Create the info button
    const infoButton = document.createElement('span');
    infoButton.textContent = 'i';
    infoButton.style.display = 'inline-flex';
    infoButton.style.alignItems = 'center';
    infoButton.style.justifyContent = 'center';
    infoButton.style.width = '18px';
    infoButton.style.height = '18px';
    infoButton.style.borderRadius = '50%';
    infoButton.style.backgroundColor = 'transparent'; // Empty circle
    infoButton.style.border = '1px solid rgba(0, 0, 0, 0.3)'; // Add stroke
    infoButton.style.color = '#666'; // Text color
    infoButton.style.fontSize = '12px';
    infoButton.style.fontWeight = 'bold';
    infoButton.style.cursor = 'help';
    infoButton.style.transition = 'background-color 0.2s, border-color 0.2s';
    
    // Create the tooltip
    const tooltip = document.createElement('div');
    tooltip.textContent = 'Notes never leave your computer. But if you switch computers, they don\'t go to the next one.';
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '30px';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.width = '220px';
    tooltip.style.padding = '8px';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.textAlign = 'center';
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    tooltip.style.transition = 'opacity 0.3s, visibility 0.3s';
    tooltip.style.zIndex = '10000'; // Extremely high z-index to ensure it's always on top
    
    // Add a small arrow at the bottom of the tooltip
    const arrow = document.createElement('div');
    arrow.style.position = 'absolute';
    arrow.style.bottom = '-5px';
    arrow.style.left = '50%';
    arrow.style.transform = 'translateX(-50%)';
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderLeft = '5px solid transparent';
    arrow.style.borderRight = '5px solid transparent';
    arrow.style.borderTop = '5px solid rgba(0, 0, 0, 0.8)';
    
    // Add hover effects
    infoButton.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
        infoButton.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'; // Slightly darker on hover
        infoButton.style.borderColor = 'rgba(0, 0, 0, 0.5)'; // Darker border on hover
    });
    
    infoButton.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        infoButton.style.backgroundColor = 'transparent';
        infoButton.style.borderColor = 'rgba(0, 0, 0, 0.3)';
    });
    
    // Assemble the components
    tooltip.appendChild(arrow);
    infoContainer.appendChild(infoButton);
    infoContainer.appendChild(tooltip);
    
    // Add the info button after the footer text
    const footerText = footer.querySelector('p');
    if (footerText) {
        footerText.appendChild(infoContainer);
    } else {
        footer.appendChild(infoContainer);
    }
}

// Add this function to create and manage the custom cursor
function setupCustomCursor() {
    // Create the cursor element
    cursorElement = document.createElement('div');
    cursorElement.className = 'cursor-postit';
    cursorElement.style.position = 'fixed';
    cursorElement.style.width = '10px'; // 5% of 200px
    cursorElement.style.height = '10px'; // 5% of 200px
    cursorElement.style.backgroundColor = getColorFromClass(lastColorClass);
    cursorElement.style.boxShadow = '0 1px 2px rgba(0,0,0,0.16)';
    cursorElement.style.borderRadius = '1px';
    cursorElement.style.pointerEvents = 'none'; // Ensure it doesn't interfere with clicks
    cursorElement.style.zIndex = '1000';
    cursorElement.style.opacity = '0'; // Start hidden
    cursorElement.style.transition = 'opacity 0.1s';
    cursorElement.style.transform = 'translate(-50%, -50%)'; // Center on cursor
    
    // Add to document
    document.body.appendChild(cursorElement);
    
    // Track mouse movement
    document.addEventListener('mousemove', updateCursorPosition);
    
    // Track editing state for cursor visibility
    document.addEventListener('focusin', updateCursorVisibility);
    document.addEventListener('focusout', updateCursorVisibility);
}

// Function to update cursor position
function updateCursorPosition(e) {
    if (!cursorElement) return;
    
    // Position the cursor
    cursorElement.style.left = `${e.clientX}px`;
    cursorElement.style.top = `${e.clientY}px`;
    
    // Check if mouse is over the drop area
    const isOverDropArea = isPointInDropArea(e.clientX, e.clientY);
    
    // Check if we're editing
    const isEditing = isEditingNote();
    
    // Show cursor only if over drop area and not editing
    cursorElement.style.opacity = (isOverDropArea && !isEditing) ? '1' : '0';
    
    // Update the cursor color to match the last used post-it color
    cursorElement.style.backgroundColor = getColorFromClass(lastColorClass);
}

// Function to update cursor visibility based on editing state
function updateCursorVisibility() {
    if (!cursorElement) return;
    
    // If editing, hide the cursor
    if (isEditingNote()) {
        cursorElement.style.opacity = '0';
    } else {
        // Otherwise, update based on position
        const mouseX = parseInt(cursorElement.style.left) || 0;
        const mouseY = parseInt(cursorElement.style.top) || 0;
        const isOverDropArea = isPointInDropArea(mouseX, mouseY);
        cursorElement.style.opacity = isOverDropArea ? '1' : '0';
    }
}

// Helper function to check if a point is within the drop area
function isPointInDropArea(x, y) {
    if (!dropArea.active || !dropArea.element) return false;
    
    const result = (
        x >= dropArea.x &&
        x <= dropArea.x + dropArea.width &&
        y >= dropArea.y &&
        y <= dropArea.y + dropArea.height
    );
    
    // Debug log only if the result changes or occasionally
    if (Math.random() < 0.01) { // Only log 1% of the time to avoid console spam
        console.log('Point in drop area check:', { 
            point: { x, y }, 
            bounds: { 
                x: dropArea.x, 
                y: dropArea.y, 
                width: dropArea.width, 
                height: dropArea.height 
            }, 
            result 
        });
    }
    
    return result;
}

// Helper function to get CSS color from color class
function getColorFromClass(colorClass) {
    switch (colorClass) {
        case 'color-1': return '#FFADAD'; // Pastel red
        case 'color-2': return '#FFD6A5'; // Pastel orange
        case 'color-3': return '#FDFFB6'; // Pastel yellow (default)
        case 'color-4': return '#CAFFBF'; // Pastel green
        case 'color-5': return '#A0C4FF'; // Pastel blue
        default: return '#FDFFB6';        // Yellow as fallback
    }
}

// Add a new function to update note positions when container is resized
function updateNotesOnResize() {
    // Skip if drop area dimensions aren't available
    if (!dropArea.width || !dropArea.height) {
        console.log('Cannot update notes: drop area dimensions not available');
        return;
    }
    
    // Get all note elements
    const noteElements = document.querySelectorAll('.note');
    if (noteElements.length === 0) return;
    
    console.log('Updating note positions on resize. Drop area dimensions:', 
                { width: dropArea.width, height: dropArea.height });
    
    // Update each note's position
    noteElements.forEach(noteElement => {
        // Find the corresponding note data
        const note = notes.find(n => n.id === noteElement.id);
        if (note && note.xPercent !== undefined && note.yPercent !== undefined) {
            // Calculate new absolute positions based on percentages
            const newX = (note.xPercent / 100) * dropArea.width;
            const newY = (note.yPercent / 100) * dropArea.height;
            
            // Apply new positions to the DOM element
            noteElement.style.left = `${newX}px`;
            noteElement.style.top = `${newY}px`;
            
            // Update the note object's absolute positions
            note.x = newX;
            note.y = newY;
            
            console.log(`Repositioned note ${note.id}: ${note.xPercent}% -> ${newX}px, ${note.yPercent}% -> ${newY}px`);
        }
    });
    
    // Save changes
    saveNotes(false); // Skip adding to history
}