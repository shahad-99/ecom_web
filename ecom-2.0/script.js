/**
 * script.js (Main & Shared Logic)
 * Handles interactivity for the e-commerce store (index page primarily) and provides global functions.
 * Includes:
 * - Product fetching, rendering (grid), filtering, search (Index Page)
 * - Global Cart functionality (localStorage, updates)
 * - Product detail modal (Quick View - Index Page)
 * - Global Login/Signup modal functionality
 * - Global Sidebar management (Nav, Cart, Filters)
 * - Global Image Zoom functionality
 * - Global Utility functions (getElement, debounce, copyToClipboard, calculateDiscountedPrice)
 * - Initializes common listeners *only* when appropriate.
 *
 * Version: 3.3 (Fixes duplicate common listener initialization)
 */

// --- Make Cart Data and Functions Globally Accessible ---
try {
    // Attempt to parse cart data from localStorage
    window.cart = JSON.parse(localStorage.getItem('shoppingCart')) || {};
    // Validate if the parsed data is a non-null object
    if (typeof window.cart !== 'object' || window.cart === null) {
        console.warn("Invalid cart data in localStorage, resetting.");
        window.cart = {};
        localStorage.setItem('shoppingCart', '{}'); // Ensure localStorage is reset too
    }
} catch (e) {
    // Handle potential JSON parsing errors
    console.error("Error parsing cart data from localStorage:", e);
    window.cart = {}; // Default to an empty cart on error
}
window.allProductsData = []; // Store fetched product data globally
window.lastFocusedElement = null; // For restoring focus globally after closing popups

// --- Global Utility Functions ---

/**
 * Safely gets an element by ID or selector.
 * @param {string} id - The ID of the element.
 * @param {boolean} [critical=false] - If true, logs an error if the element is not found.
 * @param {string|null} [selector=null] - Optional CSS selector to use instead of ID.
 * @returns {HTMLElement|null} The found element or null.
 */
const getElement = (id, critical = false, selector = null) => {
    const element = selector ? document.querySelector(selector) : document.getElementById(id);
    if (!element && critical) {
        console.error(`CRITICAL ERROR: Element with ${selector ? `selector '${selector}'` : `ID '${id}'`} not found.`);
    } else if (!element && !critical) {
        // Optional: Log a warning for non-critical missing elements if needed during development
        // console.warn(`Warning: Element with ${selector ? `selector '${selector}'` : `ID '${id}'`} not found.`);
    }
    return element;
};

/**
 * Creates a debounced version of a function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} delay - The number of milliseconds to delay.
 * @returns {Function} The new debounced function.
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

/**
 * Copies text to the clipboard using the Clipboard API and provides feedback.
 * @param {string} text - The text to copy.
 * @param {HTMLElement|null} buttonElement - The button element that triggered the copy (optional, for feedback).
 */
window.copyToClipboard = (text, buttonElement) => {
    if (!navigator.clipboard) {
        console.warn("Clipboard API not available.");
        alert("Sorry, copying is not supported in this browser."); // Fallback message
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        console.log('Text copied to clipboard:', text);
        const icon = buttonElement?.querySelector('i');
        const feedbackSpan = buttonElement?.nextElementSibling; // Assumes feedback span is immediate sibling
        const originalIconClass = 'far fa-copy';
        const copiedIconClass = 'fas fa-check'; // FontAwesome check icon

        // Provide visual feedback
        if (icon) icon.className = copiedIconClass;
        if (feedbackSpan) feedbackSpan.textContent = 'Copied!';

        // Reset feedback after a delay
        setTimeout(() => {
            // Only reset if the icon/text hasn't been changed again by another action
            if (icon && icon.className === copiedIconClass) {
                 icon.className = originalIconClass;
            }
            if (feedbackSpan) feedbackSpan.textContent = '';
        }, 2000); // Reset after 2 seconds

    }).catch(err => {
        console.error('Failed to copy text: ', err);
        const feedbackSpan = buttonElement?.nextElementSibling;
        // Provide error feedback
        if(feedbackSpan) feedbackSpan.textContent = 'Failed!';
        setTimeout(() => { if (feedbackSpan) feedbackSpan.textContent = ''; }, 2000);
        // Avoid intrusive alert for copy failure unless necessary
        // alert("Failed to copy ID. Please try again or copy manually.");
    });
};

/**
 * Calculates the final price after applying a discount and provides discount details.
 * @param {number} price - The original price.
 * @param {object|null} discount - The discount object { type: 'percent'|'fixed', value: number } or null.
 * @returns {{finalPrice: number, discountText: string|null, originalPrice: number, hasDiscount: boolean}}
 */
window.calculateDiscountedPrice = (price, discount) => {
    // Default result if price is invalid
    const defaultResult = { finalPrice: price, discountText: null, originalPrice: price, hasDiscount: false };
    if (typeof price !== 'number' || isNaN(price) || price < 0) { // Allow price of 0
        return defaultResult;
    }

    let finalPrice = price;
    let discountText = null;
    let hasDiscount = false;

    // Check if a valid discount object is provided
    if (discount && typeof discount.value === 'number' && discount.value > 0) {
        if (discount.type === 'percent' && discount.value > 0 && discount.value <= 100) {
            // Calculate percentage discount
            finalPrice = price * (1 - discount.value / 100);
            discountText = `${discount.value}% off`;
            hasDiscount = true;
        } else if (discount.type === 'fixed') {
            // Calculate fixed discount, ensuring price doesn't go below zero
            finalPrice = Math.max(0, price - discount.value);
             // Only consider it a discount if the price actually decreased
            if (finalPrice < price) {
                discountText = `-$${discount.value.toFixed(2)}`;
                hasDiscount = true;
            } else {
                finalPrice = price; // Reset if fixed discount was >= price or zero
            }
        }
    }

    // Round final price to 2 decimal places and ensure it's not higher than original
    finalPrice = parseFloat(finalPrice.toFixed(2));
    if (finalPrice >= price) {
        finalPrice = price; // Reset if calculation didn't result in a lower price
        discountText = null;
        hasDiscount = false;
    }

    return {
        finalPrice,
        discountText,
        originalPrice: parseFloat(price.toFixed(2)), // Format original for consistency
        hasDiscount // Boolean flag indicating if a discount was applied
    };
};

// --- Global Cart Functionality ---

/**
 * Updates the cart sidebar UI and saves the cart state to localStorage.
 */
window.updateCartDisplay = () => {
    // Get elements safely, return early if critical ones are missing on the current page
    const cartItemsList = getElement('cart-items-list');
    const cartCountSpan = getElement('cart-count', false, '.cart-count'); // Non-critical for functionality
    const cartTotalAmount = getElement('cart-total-amount');
    const cartSidebar = getElement('cart-sidebar'); // Needed to find child elements reliably

    // If sidebar or essential list/total elements don't exist, can't update
    if (!cartSidebar || !cartItemsList || !cartTotalAmount) {
        // console.log("Cart display elements not fully present. Skipping cart update.");
        return;
    }
    // Find child elements within the sidebar
    const cartEmptyMsg = cartSidebar.querySelector('.cart-empty-msg');
    const checkoutBtn = cartSidebar.querySelector('.checkout-btn');

    // Check if child elements were found
    if (!cartEmptyMsg || !checkoutBtn) {
        console.warn("Cart empty message or checkout button not found within sidebar.");
        // Attempt to continue updating what is available
    }

    cartItemsList.innerHTML = ''; // Clear current items display
    let totalItems = 0;
    let currentCartTotal = 0;
    const productIds = Object.keys(window.cart || {}); // Use the global cart object

    // Handle empty cart state
    if (productIds.length === 0) {
        if (cartEmptyMsg) cartEmptyMsg.style.display = 'block';
        if (checkoutBtn) checkoutBtn.disabled = true;
    } else {
        // Populate cart items if not empty
        if (cartEmptyMsg) cartEmptyMsg.style.display = 'none';
        if (checkoutBtn) checkoutBtn.disabled = false;

        productIds.forEach(id => {
            const item = window.cart[id];
            // Validate item data before displaying - remove invalid items
            if (!item || typeof item.quantity !== 'number' || typeof item.price !== 'number' || item.quantity <= 0 || isNaN(item.price)) {
                console.warn(`Invalid item data found in cart, removing: ID ${id}`, item);
                delete window.cart[id]; // Remove invalid item from the global cart object
                return; // Skip rendering this item
            }

            // Calculate totals for valid items
            totalItems += item.quantity;
            currentCartTotal += item.price * item.quantity;

            // Create and append cart item HTML
            const cartItemEl = document.createElement('div');
            cartItemEl.classList.add('cart-item');
            cartItemEl.setAttribute('role', 'listitem'); // Accessibility: mark as list item
            cartItemEl.innerHTML = `
                <div class="cart-item-details">
                    <h4>${item.name || 'Unknown Product'} (x${item.quantity})</h4>
                    <span class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <button type="button" class="cart-item-remove-btn" data-id="${id}" aria-label="Remove ${item.name || 'product'} from cart">
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>`;
            cartItemsList.appendChild(cartItemEl);
        });

        // Re-check if cart became empty after removing invalid items
        if (Object.keys(window.cart).length === 0) {
            if (cartEmptyMsg) cartEmptyMsg.style.display = 'block';
            if (checkoutBtn) checkoutBtn.disabled = true;
        }
    }

    // Update cart count indicator (if it exists)
    if(cartCountSpan) cartCountSpan.textContent = totalItems;
    // Update total amount display
    cartTotalAmount.textContent = currentCartTotal.toFixed(2);

    // Save the potentially modified cart back to localStorage
    try {
        localStorage.setItem('shoppingCart', JSON.stringify(window.cart));
    } catch (e) {
        console.error("Error saving cart to localStorage:", e);
        // Optionally notify user if saving fails
        // alert("Warning: Could not save your cart changes. Your cart might reset on page refresh.");
    }
    // console.log("Cart display updated & saved. Items:", totalItems, "Total:", currentCartTotal.toFixed(2));
};

/**
 * Adds or updates a product in the global cart object and triggers a UI update.
 * @param {string} productId - The ID of the product.
 * @param {string} productName - The name of the product.
 * @param {number|string} productPrice - The price of the product.
 */
window.addToCart = (productId, productName, productPrice) => {
    const price = parseFloat(productPrice); // Ensure price is a number

    // Validate input data
    if (!productId || !productName || typeof productName !== 'string' || isNaN(price) || price < 0) {
        alert("Could not add item: invalid product data provided.");
        console.error("Invalid data passed to addToCart:", { productId, productName, productPrice });
        return;
    }

    // Update quantity if item exists, otherwise add new item
    if (window.cart[productId]) {
        window.cart[productId].quantity++;
    } else {
        window.cart[productId] = { name: productName, price: price, quantity: 1 };
    }
    console.log(`Added/updated item in cart: ${productName} (ID: ${productId}) at price $${price}`);

    // Update the UI and save to localStorage
    window.updateCartDisplay();

    // Optional: Visual feedback (pulse cart icon)
    const cartToggle = getElement('cart-toggle');
    if (cartToggle) {
        cartToggle.classList.remove('item-added-pulse'); // Remove class if already present
        void cartToggle.offsetWidth; // Force browser reflow to restart animation
        cartToggle.classList.add('item-added-pulse');
        // Remove class after animation duration (defined in CSS) + buffer
        setTimeout(() => { cartToggle?.classList.remove('item-added-pulse'); }, 650);
    }
};

// --- Global Overlay / Modal / Sidebar Management ---

/** Checks if the main sidebar overlay is visible. */
const isSidebarOverlayActive = () => getElement('overlay')?.classList.contains('visible');
/** Checks if any modal overlay (product or auth) is visible. */
const isModalOverlayActive = () => getElement('modal-overlay')?.classList.contains('visible') || getElement('auth-modal-overlay')?.classList.contains('visible');
/** Checks if the zoom overlay is visible. */
const isZoomOverlayActive = () => getElement('zoom-overlay')?.classList.contains('visible');

/** Toggles the 'no-scroll' class on the body based on any active overlay. */
const updateBodyScroll = () => {
    const shouldLockScroll = isSidebarOverlayActive() || isModalOverlayActive() || isZoomOverlayActive();
    document.body.classList.toggle('no-scroll', shouldLockScroll);
};

/**
 * Opens a specific overlay and stores the currently focused element.
 * @param {HTMLElement} specificOverlay - The overlay element to open.
 */
const openOverlay = (specificOverlay) => {
    if (!specificOverlay || specificOverlay.classList.contains('visible')) return;
    window.lastFocusedElement = document.activeElement; // Store focus *before* showing overlay
    specificOverlay.classList.add('visible');
    specificOverlay.setAttribute('aria-hidden', 'false');
    updateBodyScroll(); // Apply scroll lock
};

/**
 * Closes a specific overlay and restores focus to the stored element.
 * @param {HTMLElement} specificOverlay - The overlay element to close.
 * @param {HTMLElement|null} [restoreFocusTo=null] - Optional specific element to restore focus to.
 */
const closeOverlay = (specificOverlay, restoreFocusTo = null) => {
    if (!specificOverlay || !specificOverlay.classList.contains('visible')) return;
    specificOverlay.classList.remove('visible');
    specificOverlay.setAttribute('aria-hidden', 'true');

    // Use a short delay for CSS transitions to start before restoring focus and updating scroll
    setTimeout(() => {
        // Determine which element to focus: the specific one passed, the globally stored one, or null
        const elementToFocus = restoreFocusTo || window.lastFocusedElement;
        if (elementToFocus && typeof elementToFocus.focus === 'function') {
             try {
                 elementToFocus.focus({ preventScroll: true }); // preventScroll might help avoid jumps
             } catch (e) {
                 console.warn("Could not restore focus:", e);
             }
        }
        window.lastFocusedElement = null; // Clear stored element after attempting focus
        updateBodyScroll(); // Recalculate scroll lock status *after* transition/focus attempt
    }, 50); // 50ms delay, adjust if needed based on CSS transition times
};

/**
 * Opens a sidebar, manages ARIA attributes, opens the main overlay, and focuses the first element.
 * @param {HTMLElement} sidebar - The sidebar element to open.
 * @param {HTMLElement} triggerButton - The button that triggered the sidebar opening.
 * @param {HTMLElement} [specificOverlay=getElement('overlay')] - The overlay to use.
 */
const openSidebar = (sidebar, triggerButton, specificOverlay = getElement('overlay')) => {
    if (!sidebar || sidebar.classList.contains('visible')) return;
    closeAllPopups(); // Close any other open popups first
    sidebar.classList.add('visible');
    sidebar.setAttribute('aria-hidden', 'false');
    openOverlay(specificOverlay); // Open the associated overlay (stores focus on triggerButton)
    if (triggerButton) triggerButton.setAttribute('aria-expanded', 'true');

    // Focus the first focusable element inside the sidebar after transition
    const firstFocusable = sidebar.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        setTimeout(() => {
            try { firstFocusable.focus(); } catch(e) { console.warn("Focus failed in openSidebar", e); }
        }, 310); // Delay slightly longer than CSS transition (0.3s)
    }
    console.log(`Sidebar opened: ${sidebar.id}`);
};

/**
 * Closes a sidebar, manages ARIA attributes, and closes the main overlay, restoring focus to the trigger.
 * @param {HTMLElement} sidebar - The sidebar element to close.
 * @param {HTMLElement} triggerButton - The button that triggered the sidebar opening (to restore focus).
 * @param {HTMLElement} [specificOverlay=getElement('overlay')] - The overlay to use.
 */
const closeSidebar = (sidebar, triggerButton, specificOverlay = getElement('overlay')) => {
    if (!sidebar || !sidebar.classList.contains('visible')) return;
    sidebar.classList.remove('visible');
    sidebar.setAttribute('aria-hidden', 'true');
    if (triggerButton) triggerButton.setAttribute('aria-expanded', 'false');
    closeOverlay(specificOverlay, triggerButton); // Close overlay, restore focus to trigger
    console.log(`Sidebar closed: ${sidebar.id}`);
};

/** Closes all sidebars that use the main overlay ('#overlay'). */
const closeAllSidebars = () => {
    const mobileNav = getElement('utility-nav-mobile');
    const mobileMenuToggle = getElement('mobile-menu-toggle');
    const cartSidebar = getElement('cart-sidebar');
    const cartToggle = getElement('cart-toggle');
    const filterSidebar = getElement('filters-sidebar'); // Get filter sidebar
    const mobileFilterToggle = getElement('mobile-filter-toggle'); // Get its toggle

    // Close each sidebar if it's visible, restoring focus to its respective toggle
    if (mobileNav?.classList.contains('visible')) { closeSidebar(mobileNav, mobileMenuToggle, getElement('overlay')); }
    if (cartSidebar?.classList.contains('visible')) { closeSidebar(cartSidebar, cartToggle, getElement('overlay')); }
    // Specifically close filter sidebar if it's visible (on mobile)
    if (filterSidebar?.classList.contains('visible')) { closeSidebar(filterSidebar, mobileFilterToggle, getElement('overlay')); }
};

/** Closes the Product Quick View modal. */
const closeProductModal = () => {
    const productModal = getElement('product-modal');
    if (!productModal || !productModal.classList.contains('visible')) return;
    closeOverlay(getElement('modal-overlay'), window.lastFocusedElement); // Use global focus store
    productModal.classList.remove('visible');
    productModal.setAttribute('aria-hidden', 'true');
    console.log("Product modal closed");
};

/** Closes the Authentication (Login/Signup) modal. */
const closeAuthModal = () => {
     const authModal = getElement('auth-modal');
     const authModalOverlay = getElement('auth-modal-overlay');
     if (!authModal || !authModalOverlay || !authModal.classList.contains('visible')) return;
     closeOverlay(authModalOverlay, window.lastFocusedElement); // Use global focus store
     authModal.classList.remove('visible');
     authModal.setAttribute('aria-hidden', 'true');
     console.log("Auth modal closed");
 };

// --- Global Image Zoom Functionality ---

/**
 * Opens the image zoom overlay with the specified image.
 * @param {string} imageUrl - The URL of the image to zoom.
 * @param {string} [altText='Zoomed product image'] - The alt text for the zoomed image.
 */
window.openZoom = (imageUrl, altText = 'Zoomed product image') => {
     const zoomOverlay = getElement('zoom-overlay');
     const zoomedImage = getElement('zoomed-image');
     const closeZoomBtn = zoomOverlay?.querySelector('.close-zoom-btn');

     // Ensure necessary elements and URL are present
     if (!zoomOverlay || !zoomedImage || !imageUrl) {
        console.warn("Cannot open zoom: Missing elements or image URL.");
        return;
     }
     // closeAllPopups(); // Optional: Close other popups first if zoom should be exclusive

     // Set image source and alt text
     zoomedImage.src = imageUrl;
     zoomedImage.alt = altText;

     // Open the overlay (this uses the global function which stores focus)
     openOverlay(zoomOverlay);

     // Focus the close button after a short delay for transition
     if (closeZoomBtn) {
        setTimeout(() => {
            try { closeZoomBtn.focus(); } catch(e) {console.warn("Focus failed in openZoom", e);}
        }, 100); // Shorter delay might suffice for zoom
    }
    console.log("Image zoom opened");
};

/** Closes the image zoom overlay. */
const closeZoom = () => {
     const zoomOverlay = getElement('zoom-overlay');
     if (!zoomOverlay || !zoomOverlay.classList.contains('visible')) return;
     // Close overlay, restoring focus using the globally stored element
     closeOverlay(zoomOverlay, window.lastFocusedElement);
     console.log("Image zoom closed");
     // Optional: Clear the zoomed image src after closing to save memory
     // const zoomedImage = getElement('zoomed-image');
     // if (zoomedImage) zoomedImage.src = '';
};

/** Closes the top-most active popup (Zoom > Auth Modal > Product Modal > Sidebars). */
const closeAllPopups = () => {
    if (isZoomOverlayActive()) {
        closeZoom();
    } else if (getElement('auth-modal')?.classList.contains('visible')) { // Check specific modal visibility
        closeAuthModal();
    } else if (getElement('product-modal')?.classList.contains('visible')) { // Check specific modal visibility
        closeProductModal();
    } else if (isSidebarOverlayActive()) { // Only close sidebars if no modal/zoom is active
        closeAllSidebars();
    }
};

// --- Main DOMContentLoaded Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the index page by looking for the product grid
    const productGrid = getElement('product-grid');

    if (productGrid) {
        // --- INDEX PAGE SPECIFIC LOGIC ---
        console.log("DOM fully loaded - Initializing E-commerce Script v3.3 (Index Page)");

        // --- Element References (Index Page Specific) ---
        const body = document.body;
        const searchBar = getElement('search-bar');
        const searchButton = getElement('search-button', false, '.search-button');
        const mobileFilterToggle = getElement('mobile-filter-toggle'); // Ref needed for context
        const filterSidebar = getElement('filters-sidebar');
        // closeFiltersBtn is handled by common listeners
        const applyFiltersBtn = filterSidebar?.querySelector('.apply-filters-btn');
        const clearFiltersBtn = getElement('clear-filters-btn');
        const categoryList = getElement('category-filter-list');
        const minPriceSlider = getElement('min-price');
        const maxPriceSlider = getElement('max-price');
        const minPriceValueSpan = getElement('min-price-value');
        const maxPriceValueSpan = getElement('max-price-value');
        const brandList = getElement('brand-filter-list');

        // Modal Elements (Quick View)
        const productModal = getElement('product-modal');
        const modalOverlay = getElement('modal-overlay');
        const closeModalBtn = productModal?.querySelector('.close-modal-btn');
        const modalMainImg = getElement('modal-main-img');
        const modalThumbnailsContainer = getElement('modal-thumbnails');
        const modalProductName = getElement('modal-product-name');
        const modalPriceContainer = productModal?.querySelector('.modal-price-container');
        const modalProductDescription = getElement('modal-product-description');
        const modalAddToCartBtn = getElement('modal-add-to-cart-btn');
        const modalProductIdSpan = getElement('modal-copy-id');
        const modalCopyIdBtn = productModal?.querySelector('.copy-id-btn');

        // --- State Variables (Index Page Specific) ---
        let visibleProductCards = [];
        let selectedCategory = ""; // Default to "All Categories"
        let isLoading = false;

        // --- Product Detail Modal Functions (Quick View - Index Page) ---
        const openProductModal = (product) => {
            if (!productModal || !modalOverlay || !product) { console.error("Missing elements or product data for modal"); alert("Sorry, could not display product details."); return; }
            if (!modalProductName || !modalPriceContainer || !modalProductDescription || !modalMainImg || !modalThumbnailsContainer || !modalAddToCartBtn || !modalProductIdSpan || !modalCopyIdBtn) { console.error("Missing critical modal content elements"); alert("Sorry, could not display complete product details."); return; }

            closeAllPopups(); // Close others first

            const { finalPrice, discountText, originalPrice, hasDiscount } = window.calculateDiscountedPrice(product.price, product.discount);

            modalProductName.textContent = product.name || "Product Name Unavailable";
            modalProductDescription.textContent = product.description || "No description available.";
            modalProductIdSpan.textContent = product.id || 'N/A';
            modalPriceContainer.innerHTML = `
                ${hasDiscount ? `<span class="original-price" id="modal-original-price">$${originalPrice.toFixed(2)}</span>` : ''}
                <span class="discounted-price" id="modal-discounted-price">$${finalPrice.toFixed(2)}</span>
                ${discountText ? `<span class="discount-badge" id="modal-discount-badge">${discountText}</span>` : ''}
            `;

            modalThumbnailsContainer.innerHTML = '';
            let mainImageUrl = 'https://via.placeholder.com/600x450/EEE/text=No+Image';
            let canZoom = false;
            if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
                const validImageUrls = product.imageUrls.filter(url => typeof url === 'string' && url.trim() !== '');
                if (validImageUrls.length > 0) {
                    mainImageUrl = validImageUrls[0];
                    canZoom = !mainImageUrl.includes('placeholder');
                    validImageUrls.forEach((url, index) => { /* ... create thumbnails ... */
                        const thumb = document.createElement('img');
                        thumb.src = url;
                        thumb.alt = `Thumbnail ${index + 1} for ${product.name || 'product'}`;
                        thumb.dataset.imageUrl = url;
                        thumb.loading = 'lazy';
                        if (index === 0) thumb.classList.add('active-thumbnail');
                        thumb.onerror = () => { thumb.style.display = 'none'; console.warn("Modal thumbnail failed to load:", url); };
                        modalThumbnailsContainer.appendChild(thumb);
                     });
                }
            }
            modalMainImg.src = mainImageUrl;
            modalMainImg.alt = product.altText || product.name || 'Product image';
            modalMainImg.dataset.zoomable = canZoom.toString();
            modalMainImg.style.cursor = canZoom ? 'zoom-in' : 'default';
            modalMainImg.onerror = () => { /* ... handle main image error ... */
                 modalMainImg.src = 'https://via.placeholder.com/600x450/FEE/text=Image+Error';
                 modalMainImg.alt = 'Image failed to load';
                 modalMainImg.dataset.zoomable = 'false';
                 modalMainImg.style.cursor = 'default';
             };

            modalAddToCartBtn.dataset.productId = product.id;
            modalAddToCartBtn.dataset.productName = encodeURIComponent(product.name || 'Unknown Product');
            modalAddToCartBtn.dataset.productPrice = finalPrice;
            modalCopyIdBtn.dataset.copyText = product.id || '';

            productModal.classList.add('visible');
            productModal.setAttribute('aria-hidden', 'false');
            openOverlay(modalOverlay);

            if (closeModalBtn) setTimeout(() => { try { closeModalBtn.focus(); } catch(e) {console.warn("Focus failed in openProductModal", e);} }, 310);
            console.log("Product modal opened for:", product.name);
        };

        // --- Product Loading & Rendering (Index Page Grid) ---
        const displayMessage = (container, message, type = 'info') => { /* ... same as before ... */
            if (!container) return;
            let className = 'loading-message';
            if (type === 'error') className = 'error-message';
            if (type === 'no-results') className = 'no-products-message';
            const existingMsg = container.querySelector('.loading-message, .error-message, .no-products-message');
            if (existingMsg) existingMsg.remove();
            container.insertAdjacentHTML('beforeend', `<p class="${className}">${message}</p>`);
         };
        const createProductCardHTML = (product) => { /* ... same as before ... */
            if (!product || typeof product.id !== 'string' || typeof product.name !== 'string' || typeof product.price !== 'number') { return ''; }
            const { id, name, price, altText, imageUrls, discount } = product;
            const { finalPrice, discountText, originalPrice, hasDiscount } = window.calculateDiscountedPrice(price, discount);
            const imageAlt = altText || name || 'Product image';
            const gridImageUrl = (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0 && typeof imageUrls[0] === 'string' && imageUrls[0].trim()) ? imageUrls[0] : 'https://via.placeholder.com/250x200/EEE/text=No+Image';
            const encodedName = encodeURIComponent(name);
            return `
                <article class="product-card" data-id="${id}">
                     <div class="product-card-top">
                         <button class="view-details-btn" data-product-id="${id}" aria-label="View quick details for ${name}"><i class="fas fa-eye"></i></button>
                        <a href="product-detail.html?id=${id}" class="product-card-link" aria-label="View full details for ${name}">
                            <div class="product-card-image-wrapper"><img src="${gridImageUrl}" alt="${imageAlt}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/250x200/FEE/text=Load+Error'; this.alt='Image failed to load';"></div>
                            <h3 id="product-name-${id}">${name}</h3>
                            <div class="price-container">
                                 ${hasDiscount ? `<span class="original-price">$${originalPrice.toFixed(2)}</span>` : ''}
                                 <span class="discounted-price">$${finalPrice.toFixed(2)}</span>
                                 ${discountText ? `<span class="discount-badge">${discountText}</span>` : ''}
                            </div>
                        </a>
                    </div>
                    <button type="button" class="add-to-cart-btn" aria-label="Add ${name} to cart" data-product-id="${id}" data-product-name="${encodedName}" data-product-price="${finalPrice}"><i class="fas fa-cart-plus" aria-hidden="true"></i> Add to Cart</button>
                </article>`;
         };
        const renderProducts = (products) => { /* ... same as before, ensures filters are enabled/disabled correctly ... */
            console.log("Attempting to render products on index page...");
            if (!productGrid) { console.error("Product grid element not found in renderProducts"); return; }
            productGrid.innerHTML = '';
            if (!Array.isArray(products)) {
                console.error("RenderProducts received non-array data:", products);
                displayMessage(productGrid, "Failed to load products: Invalid data format.", 'error');
                window.allProductsData = []; disableFilters(); if(searchBar) searchBar.disabled = true; if(clearFiltersBtn) clearFiltersBtn.disabled = true; return;
            }
            window.allProductsData = products;
            console.log(`Stored ${window.allProductsData.length} products globally.`);
            if (window.allProductsData.length === 0) {
                displayMessage(productGrid, "No products available at this time.", 'no-results');
                disableFilters(); if (searchBar) searchBar.disabled = true; if(clearFiltersBtn) clearFiltersBtn.disabled = true; return;
            }
            const productHTML = window.allProductsData.map(createProductCardHTML).join('');
            if (productHTML.trim() === '') {
                 console.warn("No valid product card HTML was generated."); displayMessage(productGrid, "No valid product data found.", 'no-results');
                 disableFilters(); if(searchBar) searchBar.disabled = true; if(clearFiltersBtn) clearFiltersBtn.disabled = true; return;
            }
            productGrid.innerHTML = productHTML; console.log("Product grid HTML updated."); visibleProductCards = Array.from(productGrid.querySelectorAll('.product-card'));
            try {
                updateFilterInputsFromData(); enableFilters(); if (searchBar) searchBar.disabled = false;
                setActiveCategory(selectedCategory); applyAllFilters(); console.log("Index UI setup post-render complete.");
            } catch (setupError) {
                console.error("Error during index post-render UI setup:", setupError); displayMessage(productGrid, "UI setup failed.", 'error'); disableFilters();
            }
         };

        // --- Product Fetching (Index Page) ---
        const fetchProducts = async () => { /* ... same as before ... */
            if (isLoading) { console.log("Fetch already in progress."); return; }
            isLoading = true; console.log("fetchProducts (Index): Started");
            displayMessage(productGrid, "Loading products...", 'info'); disableFilters(); if (searchBar) searchBar.disabled = true; if (clearFiltersBtn) clearFiltersBtn.disabled = true;
            const url = `products.json?t=${Date.now()}`;
            try {
                const response = await fetch(url);
                if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}`); }
                const products = await response.json();
                renderProducts(products); // renderProducts handles validation and UI enabling
            } catch (error) {
                console.error("FETCH/PARSE ERROR (Index):", error); let userMessage = `Failed to load products. ${error.message || 'Please try again.'}`;
                if (error instanceof SyntaxError) { userMessage = "Failed to load products: Error reading data."; }
                renderProducts([]); displayMessage(productGrid, userMessage, 'error');
            } finally { isLoading = false; console.log("fetchProducts (Index): FINALLY block."); }
         };

        // --- Filtering Logic (Index Page) ---
        const disableFilters = () => { /* ... same as before ... */
             filterSidebar?.querySelectorAll('input, button, .category-filter-item').forEach(el => { el.disabled = true; if (el.classList.contains('category-filter-item')) el.classList.add('disabled'); });
             if (applyFiltersBtn) applyFiltersBtn.disabled = true; if (clearFiltersBtn) clearFiltersBtn.disabled = true; if (mobileFilterToggle) mobileFilterToggle.disabled = true;
         };
        const enableFilters = () => { /* ... same as before ... */
             filterSidebar?.querySelectorAll('input, button, .category-filter-item').forEach(el => { el.disabled = false; if (el.classList.contains('category-filter-item')) el.classList.remove('disabled'); });
             if (applyFiltersBtn) applyFiltersBtn.disabled = false; if (mobileFilterToggle) mobileFilterToggle.disabled = false; // Clear btn enabled by updateFilterInputsFromData
         };
        const clearFilters = () => { /* ... same as before ... */
            if (isLoading) return; setActiveCategory("");
            if (minPriceSlider) { minPriceSlider.value = minPriceSlider.min; if (minPriceValueSpan) minPriceValueSpan.textContent = minPriceSlider.value; }
            if (maxPriceSlider) { maxPriceSlider.value = maxPriceSlider.max; if (maxPriceValueSpan) maxPriceValueSpan.textContent = maxPriceSlider.value; }
            brandList?.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
            if (searchBar) searchBar.value = ""; applyAllFilters(); console.log("Filters cleared.");
         };
        const updateFilterInputsFromData = () => { /* ... same as before, enables clear button ... */
            if (!minPriceSlider || !maxPriceSlider || !minPriceValueSpan || !maxPriceValueSpan || !window.allProductsData || window.allProductsData.length === 0) {
                console.warn("No data/elements for price filters."); if(minPriceSlider) { minPriceSlider.min = 0; minPriceSlider.max = 1200; minPriceSlider.value = 0; } if(maxPriceSlider) { maxPriceSlider.min = 0; maxPriceSlider.max = 1200; maxPriceSlider.value = 1200; } if (minPriceValueSpan) minPriceValueSpan.textContent = '0'; if (maxPriceValueSpan) maxPriceValueSpan.textContent = '1200'; if (clearFiltersBtn) clearFiltersBtn.disabled = true; return;
            }
            const prices = window.allProductsData.map(p => p.price).filter(p => typeof p === 'number' && !isNaN(p) && p >= 0);
            if (prices.length === 0) { console.warn("No valid prices found."); if (clearFiltersBtn) clearFiltersBtn.disabled = true; return; }
            const minProductPrice = Math.min(...prices); const maxProductPrice = Math.max(...prices);
            const sliderMin = Math.max(0, Math.floor(minProductPrice)); const sliderMax = Math.ceil(maxProductPrice); const finalMin = Math.min(sliderMin, sliderMax); const finalMax = Math.max(sliderMin, sliderMax);
            minPriceSlider.min = finalMin; minPriceSlider.max = finalMax; maxPriceSlider.min = finalMin; maxPriceSlider.max = finalMax; minPriceSlider.value = finalMin; maxPriceSlider.value = finalMax; minPriceValueSpan.textContent = minPriceSlider.value; maxPriceValueSpan.textContent = maxPriceSlider.value;
            if (clearFiltersBtn) clearFiltersBtn.disabled = false; console.log("Updated price sliders range:", finalMin, "-", finalMax);
         };
        const applyAllFilters = () => { /* ... same as before ... */
            if (isLoading || !productGrid) return;
            const searchTerm = searchBar ? searchBar.value.toLowerCase().trim() : ""; const currentMinPrice = minPriceSlider ? parseFloat(minPriceSlider.value) : 0; const currentMaxPrice = maxPriceSlider ? parseFloat(maxPriceSlider.value) : Infinity; const selectedBrands = brandList ? Array.from(brandList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value.toLowerCase()) : [];
            let visibleProductCount = 0; const allCards = productGrid.querySelectorAll('.product-card');
            const existingNoResultsMsg = productGrid.querySelector('.no-products-message'); if (existingNoResultsMsg) existingNoResultsMsg.remove();
            if (window.allProductsData.length === 0 && allCards.length === 0) { return; }
            allCards.forEach(card => {
                const productId = card.dataset.id; const product = window.allProductsData.find(p => p.id === productId); if (!product) { card.style.display = 'none'; return; }
                const { finalPrice } = window.calculateDiscountedPrice(product.price, product.discount);
                const nameMatches = !searchTerm || (product.name && product.name.toLowerCase().includes(searchTerm)); const categoryMatches = !selectedCategory || (product.category && product.category.toLowerCase() === selectedCategory); const priceMatches = typeof finalPrice === 'number' && finalPrice >= currentMinPrice && finalPrice <= currentMaxPrice; const brandMatches = selectedBrands.length === 0 || (product.brand && selectedBrands.includes(product.brand.toLowerCase()));
                const isVisible = nameMatches && categoryMatches && priceMatches && brandMatches; card.style.display = isVisible ? 'flex' : 'none'; if (isVisible) visibleProductCount++;
            });
            if (visibleProductCount === 0 && window.allProductsData.length > 0) { displayMessage(productGrid, "No products match your current filters.", 'no-results'); }
         };
        const debouncedApplyFilters = debounce(applyAllFilters, 350);
        function setActiveCategory(categoryValue) { /* ... same as before ... */
            selectedCategory = (typeof categoryValue === 'string') ? categoryValue.toLowerCase() : ""; categoryList?.querySelectorAll('.category-filter-item').forEach(item => { const itemCategory = item.dataset.category.toLowerCase(); item.classList.toggle('active', itemCategory === selectedCategory); });
         }

        // --- Event Listener Setup (Index Page Specific) ---
        productGrid.addEventListener('click', (event) => { /* ... same as before (handles view/add clicks) ... */
            const viewButton = event.target.closest('.view-details-btn'); const addButton = event.target.closest('.add-to-cart-btn');
            if (addButton) { event.preventDefault(); event.stopPropagation(); const { productId, productName, productPrice } = addButton.dataset; if (productId && productName && productPrice) { window.addToCart(productId, decodeURIComponent(productName), productPrice); } else { console.error("Missing data on grid Add button:", addButton.dataset); alert("Error adding item."); } }
            else if (viewButton) { event.preventDefault(); event.stopPropagation(); const productId = viewButton.dataset.productId; const product = window.allProductsData.find(p => p.id === productId); if (product) { window.lastFocusedElement = viewButton; openProductModal(product); } else { console.error("Data not found for quick view ID:", productId); alert("Details not available."); } }
         });
        if (categoryList) categoryList.addEventListener('click', (event) => { /* ... same as before ... */
             const targetItem = event.target.closest('.category-filter-item'); if (targetItem && !targetItem.classList.contains('disabled') && targetItem.dataset.category !== undefined) { setActiveCategory(targetItem.dataset.category); applyAllFilters(); }
         });
        if (modalThumbnailsContainer) modalThumbnailsContainer.addEventListener('click', (event) => { /* ... same as before ... */
            const targetThumb = event.target.closest('img'); if (targetThumb && modalMainImg) { const newImageUrl = targetThumb.dataset.imageUrl; if (newImageUrl && modalMainImg.src !== newImageUrl) { modalMainImg.src = newImageUrl; modalMainImg.alt = targetThumb.alt; modalThumbnailsContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active-thumbnail')); targetThumb.classList.add('active-thumbnail'); const isPlaceholder = newImageUrl.includes('placeholder'); const canZoom = !isPlaceholder; modalMainImg.dataset.zoomable = canZoom.toString(); modalMainImg.style.cursor = canZoom ? 'zoom-in' : 'default'; } }
         });
        if (modalCopyIdBtn) modalCopyIdBtn.addEventListener('click', (e) => { /* ... same as before ... */
            e.stopPropagation(); const textToCopy = modalCopyIdBtn.dataset.copyText; if (textToCopy && window.copyToClipboard) { window.copyToClipboard(textToCopy, modalCopyIdBtn); } else { console.warn("Copy text/function unavailable."); }
         });
        if (searchBar) searchBar.addEventListener('input', debouncedApplyFilters);
        if (searchButton && searchBar) searchButton.addEventListener('click', () => { applyAllFilters(); try{ searchBar.focus(); } catch(e){} });
        const handlePriceSliderInput = (event) => { /* ... same as before ... */
            if (!minPriceSlider || !maxPriceSlider || !minPriceValueSpan || !maxPriceValueSpan) return; const minVal = parseFloat(minPriceSlider.value); const maxVal = parseFloat(maxPriceSlider.value); if (event.target === minPriceSlider && minVal > maxVal) { minPriceSlider.value = maxVal; } else if (event.target === maxPriceSlider && maxVal < minVal) { maxPriceSlider.value = minVal; } minPriceValueSpan.textContent = minPriceSlider.value; maxPriceValueSpan.textContent = maxPriceSlider.value;
         };
        if (minPriceSlider) { minPriceSlider.addEventListener('input', handlePriceSliderInput); minPriceSlider.addEventListener('change', applyAllFilters); }
        if (maxPriceSlider) { maxPriceSlider.addEventListener('input', handlePriceSliderInput); maxPriceSlider.addEventListener('change', applyAllFilters); }
        if (brandList) brandList.addEventListener('change', (event) => { if (event.target.type === 'checkbox') applyAllFilters(); });
        if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
        if (applyFiltersBtn && filterSidebar && mobileFilterToggle) { applyFiltersBtn.addEventListener('click', () => { applyAllFilters(); if (window.innerWidth <= 768 && filterSidebar.classList.contains('visible')) { closeSidebar(filterSidebar, mobileFilterToggle); } }); }
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeProductModal);
        if (modalOverlay) modalOverlay.addEventListener('click', closeProductModal);
        if (productModal) productModal.addEventListener('click', (event) => event.stopPropagation());
        if (modalAddToCartBtn) modalAddToCartBtn.addEventListener('click', () => { /* ... same as before ... */
            const { productId, productName, productPrice } = modalAddToCartBtn.dataset; if (productId && productName && productPrice && window.addToCart) { window.addToCart(productId, decodeURIComponent(productName), productPrice); } else { console.error("Modal Add button data/function issue:", modalAddToCartBtn.dataset); alert("Error adding item."); }
         });
        if (modalMainImg && window.openZoom) { modalMainImg.addEventListener('click', () => { /* ... same as before, uses global zoom ... */
            if (modalMainImg.dataset.zoomable === 'true' && modalMainImg.src && !modalMainImg.src.includes('placeholder') && !modalMainImg.src.includes('Load+Error')) { window.lastFocusedElement = modalMainImg; window.openZoom(modalMainImg.src, modalMainImg.alt); }
         }); }

        // --- Initialize Common Listeners (Index Page) ---
        // This MUST be called here for the index page to set up header etc.
        initializeCommonListeners();

        // --- Initial Page Setup (Index Page) ---
        console.log("Performing initial setup for index page...");
        disableFilters(); // Start disabled
        if (searchBar) searchBar.disabled = true;
        window.updateCartDisplay(); // Update cart count from storage
        setActiveCategory(""); // Set "All Categories" active
        console.log("Calling fetchProducts() for index page...");
        fetchProducts(); // Load products

        console.log("Index page initial setup sequence complete.");

    } else {
        // --- NON-INDEX PAGE LOGIC ---
        // We are not on index.html. Only update cart display.
        // Common listeners will be initialized by the page-specific script (e.g., product-detail.js)
        console.log("Not on index.html. Only updating cart display from script.js.");
        window.updateCartDisplay();
    }

}); // --- END DOMCONTENTLOADED (Handles both index and non-index cases) ---


// ==========================================================================
// --- Function for Common Listeners (Called by Index OR Detail Page) ---
// ==========================================================================
function initializeCommonListeners() {
    // Get all necessary common elements
    const body = document.body;
    const overlay = getElement('overlay');
    const mobileMenuToggle = getElement('mobile-menu-toggle');
    const mobileNav = getElement('utility-nav-mobile');
    const closeNavBtn = mobileNav?.querySelector('.close-nav-btn');
    const cartToggle = getElement('cart-toggle');
    const cartSidebar = getElement('cart-sidebar');
    const closeCartBtn = cartSidebar?.querySelector('.close-cart-btn');
    const cartItemsList = getElement('cart-items-list');
    const checkoutBtn = cartSidebar?.querySelector('.checkout-btn');
    const mobileFilterToggle = getElement('mobile-filter-toggle'); // Needed for listener
    const filterSidebar = getElement('filters-sidebar'); // Needed for listener context
    const closeFiltersBtn = filterSidebar?.querySelector('.close-filters-btn'); // Needed for listener
    const zoomOverlay = getElement('zoom-overlay');
    const closeZoomBtn = zoomOverlay?.querySelector('.close-zoom-btn');
    const zoomedImage = getElement('zoomed-image');
    const authModal = getElement('auth-modal');
    const authModalOverlay = getElement('auth-modal-overlay');
    const closeAuthModalBtn = getElement('close-auth-modal');
    const loginForm = getElement('login-form');
    const signupForm = getElement('signup-form');
    const showSignupBtn = getElement('show-signup');
    const showLoginBtn = getElement('show-login');
    const authTriggers = document.querySelectorAll('.auth-trigger');

    // --- Attach Common Listeners ---
    // Mobile Nav Toggle & Close
    if (mobileMenuToggle && mobileNav) { mobileMenuToggle.addEventListener('click', (e) => { e.stopPropagation(); if (mobileNav.classList.contains('visible')) closeSidebar(mobileNav, mobileMenuToggle); else openSidebar(mobileNav, mobileMenuToggle); }); }
    if (closeNavBtn) { closeNavBtn.addEventListener('click', (e) => { e.stopPropagation(); closeSidebar(mobileNav, mobileMenuToggle); }); }

    // Mobile Filter Toggle & Close (Check elements exist before adding listener)
    if (mobileFilterToggle && filterSidebar) { mobileFilterToggle.addEventListener('click', (e) => { e.stopPropagation(); if (filterSidebar.classList.contains('visible')) closeSidebar(filterSidebar, mobileFilterToggle); else openSidebar(filterSidebar, mobileFilterToggle); }); }
    if (closeFiltersBtn && filterSidebar && mobileFilterToggle) { closeFiltersBtn.addEventListener('click', (e) => { e.stopPropagation(); closeSidebar(filterSidebar, mobileFilterToggle); }); }

    // Cart Toggle & Close
    if (cartToggle && cartSidebar) { cartToggle.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (cartSidebar.classList.contains('visible')) closeSidebar(cartSidebar, cartToggle); else openSidebar(cartSidebar, cartToggle); }); }
    if (closeCartBtn) { closeCartBtn.addEventListener('click', (e) => { e.stopPropagation(); closeSidebar(cartSidebar, cartToggle); }); }

    // Main Overlay Click (Closes Sidebars)
    if (overlay) overlay.addEventListener('click', closeAllSidebars);

    // Cart Item Remove Button (Delegated)
    if (cartItemsList) { cartItemsList.addEventListener('click', (event) => { const removeButton = event.target.closest('.cart-item-remove-btn'); if (removeButton) { const productId = removeButton.dataset.id; if (productId && window.cart[productId]) { console.log(`Removing item: ${window.cart[productId].name}`); delete window.cart[productId]; window.updateCartDisplay(); } else { console.warn(`Remove failed: Item ${productId} not in cart.`); } } }); }

    // Zoom Close Actions
    if (closeZoomBtn) closeZoomBtn.addEventListener('click', closeZoom);
    if (zoomOverlay) zoomOverlay.addEventListener('click', closeZoom);
    if (zoomedImage) zoomedImage.addEventListener('click', (event) => event.stopPropagation());

    // Checkout Button Simulation
    if (checkoutBtn) { checkoutBtn.addEventListener('click', () => { const totalAmount = getElement('cart-total-amount')?.textContent || '0.00'; if (Object.keys(window.cart).length > 0) { alert(`Simulating checkout... Total: $${totalAmount}`); console.log("Checkout Cart:", JSON.stringify(window.cart)); } else { alert("Cart is empty."); } }); }

    // Authentication Modal Handling
    const showLoginForm = () => { /* ... same as before ... */ if (!loginForm || !signupForm) return; signupForm.style.display = 'none'; signupForm.setAttribute('aria-hidden', 'true'); loginForm.style.display = 'flex'; loginForm.setAttribute('aria-hidden', 'false'); const firstFocusable = loginForm.querySelector('input:not([type="hidden"]), button'); if (firstFocusable) setTimeout(() => { try { firstFocusable.focus(); } catch(e) {/* ignore */} }, 50); };
    const showSignupForm = () => { /* ... same as before ... */ if (!loginForm || !signupForm) return; loginForm.style.display = 'none'; loginForm.setAttribute('aria-hidden', 'true'); signupForm.style.display = 'flex'; signupForm.setAttribute('aria-hidden', 'false'); const firstFocusable = signupForm.querySelector('input:not([type="hidden"]), button'); if (firstFocusable) setTimeout(() => { try { firstFocusable.focus(); } catch(e) {/* ignore */} }, 50); };
    const openAuthModal = (showForm = 'login') => { /* ... same as before ... */ if (!authModal || !authModalOverlay || authModal.classList.contains('visible')) return; closeAllPopups(); setTimeout(() => { if (authModal.classList.contains('visible')) return; if (showForm === 'signup') showSignupForm(); else showLoginForm(); openOverlay(authModalOverlay); authModal.classList.add('visible'); authModal.setAttribute('aria-hidden', 'false'); if (closeAuthModalBtn) { setTimeout(() => { try { closeAuthModalBtn.focus(); } catch(e) {} }, 100); } else { const firstInput = authModal.querySelector('form[style*="flex"] input:not([type="hidden"])'); if (firstInput) setTimeout(() => { try { firstInput.focus(); } catch(e) {} }, 100); } }, 50); };
    authTriggers.forEach(trigger => { trigger.addEventListener('click', (e) => { /* ... same as before (handles mobile nav close) ... */ e.preventDefault(); e.stopPropagation(); const showForm = trigger.dataset.show || 'login'; const mobileNav = getElement('utility-nav-mobile'); if (mobileNav?.classList.contains('visible')) { closeSidebar(mobileNav, getElement('mobile-menu-toggle'), getElement('overlay')); setTimeout(() => openAuthModal(showForm), 50); } else { openAuthModal(showForm); } }); });
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
    if (authModalOverlay) authModalOverlay.addEventListener('click', closeAuthModal);
    if (authModal) authModal.addEventListener('click', (event) => event.stopPropagation());
    if (showSignupBtn) showSignupBtn.addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });
    if (loginForm) loginForm.addEventListener('submit', (e) => { /* ... simulation ... */ e.preventDefault(); const email = loginForm.querySelector('#login-email')?.value || ''; console.log(`SIM LOGIN: ${email}`); alert(`Simulating login for ${email}.`); closeAuthModal(); });
    if (signupForm) signupForm.addEventListener('submit', (e) => { /* ... simulation + validation ... */ e.preventDefault(); const name = signupForm.querySelector('#signup-name')?.value || ''; const email = signupForm.querySelector('#signup-email')?.value || ''; const password = signupForm.querySelector('#signup-password')?.value || ''; const confirmPassword = signupForm.querySelector('#signup-confirm-password')?.value || ''; if (!name || !email || !password || !confirmPassword) { alert("Please fill all signup fields."); return; } if (password !== confirmPassword) { alert("Passwords do not match!"); signupForm.querySelector('#signup-confirm-password')?.focus(); return; } if (password.length < 6) { alert("Password minimum 6 characters."); signupForm.querySelector('#signup-password')?.focus(); return; } console.log(`SIM SIGNUP: ${name}, ${email}`); alert(`Simulating signup for ${name}.`); closeAuthModal(); });

    // Global Keydown Listener (Escape key)
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeAllPopups(); } });

    console.log("Common event listeners initialized.");
} // --- END initializeCommonListeners ---