/**
 * product-detail.js
 * Handles interactivity for the individual product detail page.
 * Includes:
 * - Fetching product data based on URL ID
 * - Populating product gallery, info, description
 * - Handling Add to Cart button
 * - Displaying recommended, trending, and recently viewed product sliders
 * - Integrating with global cart and utilities defined in script.js
 *
 * Version: 1.2 (Added Recently Viewed, uses global zoom)
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded - Initializing Product Detail Script v1.2");

    // --- Element References (Detail Page Specific) ---
    // Ensure global getElement function is available
    if (typeof getElement === 'undefined') {
        console.error("CRITICAL: Global 'getElement' function not found. Ensure script.js is loaded first.");
        // Display a user-friendly error and stop execution
        document.body.innerHTML = '<p class="error-message" style="padding: 2em; text-align: center;">Error: Page script dependency missing. Please refresh the page or contact support if the problem persists.</p>';
        return;
    }

    // Get main content and slider containers
    const productDetailContent = getElement('product-detail-content', true); // Critical for page function
    const recommendedSlider = getElement('recommended-slider'); // Optional slider
    const trendingSlider = getElement('trending-slider'); // Optional slider
    const recentlyViewedSlider = getElement('recently-viewed-slider', true); // Critical for this feature
    const loadingMsg = getElement('product-loading-msg'); // Loading indicator

    // Check if essential containers exist before proceeding
    if (!productDetailContent || !recentlyViewedSlider) {
        console.error("Essential product detail page elements missing (content area or recently viewed slider). Cannot proceed.");
        // Display error message if content area exists but others might be missing
        if (productDetailContent) {
            productDetailContent.innerHTML = '<p class="error-message" style="padding: 2em; text-align: center;">Error loading page content structure.</p>';
        }
        // Hide the entire sliders section if critical elements are missing
        const slidersContainer = document.querySelector('.product-sliders');
        if (slidersContainer) slidersContainer.style.display = 'none';
        return; // Stop script execution
    }

    // --- Recently Viewed Feature Configuration ---
    const RECENTLY_VIEWED_KEY = 'recentlyViewedProducts'; // Key for sessionStorage
    const MAX_RECENTLY_VIEWED = 8; // Max number of items to store/show in the slider
    let currentProductId = null; // Store the ID of the product being viewed on this page

    // --- Utility Functions ---

    /**
     * Displays an error message within the main product detail content area.
     * @param {string} message - The error message to display.
     */
    const displayDetailError = (message) => {
        if (productDetailContent) {
            // Replace content with error message
            productDetailContent.innerHTML = `<p class="error-message" style="padding: 2em; text-align: center;">${message}</p>`;
        } else {
            // Fallback if the main container itself is missing (shouldn't happen with checks above)
            console.error("Cannot display error message, product detail container not found.");
        }
        // Hide sliders section when the main product fails to load
        const slidersContainer = document.querySelector('.product-sliders');
        if (slidersContainer) slidersContainer.style.display = 'none';
    };

    // --- Recently Viewed Logic ---

    /**
     * Retrieves the list of recently viewed product IDs from sessionStorage.
     * @returns {string[]} An array of product IDs.
     */
    const getRecentlyViewedIds = () => {
        try {
            const stored = sessionStorage.getItem(RECENTLY_VIEWED_KEY);
            // Parse stored JSON or return empty array if null/invalid
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Error reading recently viewed items from sessionStorage:", e);
            return []; // Return empty array on error
        }
    };

    /**
     * Adds a product ID to the beginning of the recently viewed list in sessionStorage,
     * maintaining a maximum list size.
     * @param {string} productId - The ID of the product to add.
     */
    const addRecentlyViewedId = (productId) => {
        if (!productId) return; // Don't add if ID is missing
        try {
            let ids = getRecentlyViewedIds();
            // Remove the id if it already exists to move it to the front
            ids = ids.filter(id => id !== productId);
            // Add the new id to the beginning of the array
            ids.unshift(productId);
            // Limit the array to the maximum defined size
            ids = ids.slice(0, MAX_RECENTLY_VIEWED);
            // Store the updated array back into sessionStorage
            sessionStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
             // console.log("Updated recently viewed IDs:", ids);
        } catch (e) {
            console.error("Error saving recently viewed items to sessionStorage:", e);
            // Avoid alerting the user for sessionStorage errors unless critical
        }
    };


    // --- Populate Product Details (Main Content) ---

    /**
     * Populates the main product detail section with data and sets up listeners.
     * @param {object} product - The product data object.
     */
    const populateProductDetails = (product) => {
        currentProductId = product.id; // Store the ID of the product currently being viewed

        // Calculate final price and discount details using the global utility function
        const { finalPrice, discountText, originalPrice, hasDiscount } = window.calculateDiscountedPrice(product.price, product.discount);

        // Set the HTML page title dynamically
        document.title = `${product.name || 'Product'} | YourStore`;

        // Determine the main image URL, fallback to placeholder
        const mainImageUrl = (product.imageUrls && product.imageUrls.length > 0 && typeof product.imageUrls[0] === 'string' && product.imageUrls[0].trim())
                             ? product.imageUrls[0]
                             : 'https://via.placeholder.com/600x450/EEE/text=No+Image';
        const canZoom = !mainImageUrl.includes('placeholder'); // Allow zoom unless it's a placeholder

        // Generate HTML for thumbnail images
        const thumbnailsHTML = (product.imageUrls || [])
            .filter(url => typeof url === 'string' && url.trim()) // Ensure only valid URLs are used
            .map((url, index) => `
                <img src="${url}"
                     alt="Thumbnail ${index + 1} for ${product.name || 'product'}"
                     data-image-url="${url}"
                     class="${index === 0 ? 'active-thumbnail' : ''}"
                     loading="lazy"
                     onerror="this.style.display='none'; console.warn('Thumbnail failed to load:', this.src);">
            `)
            .join('');

        // Generate the main product detail HTML structure
        productDetailContent.innerHTML = `
            <div class="product-detail-container">
                <div class="product-gallery">
                     <div class="main-image-container">
                        <img src="${mainImageUrl}"
                             alt="${product.altText || product.name || 'Product image'}"
                             id="detail-main-img"
                             data-zoomable="${canZoom}"
                             style="cursor: ${canZoom ? 'zoom-in' : 'default'};"
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/600x450/FEE/text=Load+Error'; this.alt='Image failed to load'; this.dataset.zoomable='false'; this.style.cursor='default';">
                     </div>
                    <div class="thumbnails-container" id="detail-thumbnails">
                        ${thumbnailsHTML || '<p style="font-size: 0.9em; color: var(--color-text-secondary);">No additional images.</p>'}
                    </div>
                </div>
                <div class="product-info">
                    <h1 id="detail-product-name">${product.name || 'Product Name Unavailable'}</h1>
                    <p class="detail-product-id">
                        ID: <span id="detail-copy-id" class="copyable-id">${product.id || 'N/A'}</span>
                        <button class="copy-id-btn" aria-label="Copy product ID" data-copy-text="${product.id || ''}">
                            <i class="far fa-copy"></i>
                        </button>
                        <span class="copy-feedback" aria-live="polite"></span>
                    </p>
                    <div class="price-container detail-price">
                        ${hasDiscount ? `<span class="original-price" id="detail-original-price">$${originalPrice.toFixed(2)}</span>` : ''}
                        <span class="discounted-price" id="detail-discounted-price">$${finalPrice.toFixed(2)}</span>
                        ${discountText ? `<span class="discount-badge" id="detail-discount-badge">${discountText}</span>` : ''}
                    </div>
                    <p class="description" id="detail-product-description">
                        ${product.description || 'No description available.'}
                    </p>
                    <button class="add-to-cart-btn detail-add-to-cart-btn" id="detail-add-to-cart-btn" type="button"
                            data-product-id="${product.id || ''}"
                            data-product-name="${encodeURIComponent(product.name || 'Unknown Product')}"
                            data-product-price="${finalPrice}">
                        <i class="fas fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>`;

        // --- Add Event Listeners AFTER the elements are added to the DOM ---
        const mainImg = getElement('detail-main-img');
        const thumbnailsContainer = getElement('detail-thumbnails');
        const addToCartBtn = getElement('detail-add-to-cart-btn');
        const copyBtn = productDetailContent.querySelector('.copy-id-btn'); // Query within the container

        // Thumbnail Click Listener (using event delegation)
        if (thumbnailsContainer && mainImg) {
            thumbnailsContainer.addEventListener('click', (event) => {
                const targetThumb = event.target.closest('img');
                if (!targetThumb) return; // Ignore clicks not on an image

                const newImageUrl = targetThumb.dataset.imageUrl;
                // Update main image only if URL is different
                if (newImageUrl && mainImg.src !== newImageUrl) {
                    mainImg.src = newImageUrl;
                    mainImg.alt = targetThumb.alt; // Update alt text

                    // Update styling for active thumbnail
                    thumbnailsContainer.querySelectorAll('img').forEach(thumb => thumb.classList.remove('active-thumbnail'));
                    targetThumb.classList.add('active-thumbnail');

                    // Update zoom capability based on new image
                    const isPlaceholder = newImageUrl.includes('placeholder');
                    const canZoom = !isPlaceholder;
                    mainImg.dataset.zoomable = canZoom.toString();
                    mainImg.style.cursor = canZoom ? 'zoom-in' : 'default';
                }
            });
        }

        // Main Image Zoom Click Listener (Uses Global Zoom Function)
        if (mainImg && window.openZoom) { // Check if global function exists
             mainImg.addEventListener('click', () => {
                 // Check if zoom is enabled and image source is valid
                 if (mainImg.dataset.zoomable === 'true' && mainImg.src && !mainImg.src.includes('placeholder') && !mainImg.src.includes('Load+Error')) {
                     window.lastFocusedElement = mainImg; // Store this image as the focus trigger
                     window.openZoom(mainImg.src, mainImg.alt); // Call the global zoom function
                 }
             });
        } else if (!window.openZoom) {
            console.warn("Global openZoom function is missing. Zoom feature disabled.");
        }

        // Add to Cart Button Listener (Uses Global Cart Function)
        if (addToCartBtn && window.addToCart) { // Check if global function exists
            addToCartBtn.addEventListener('click', () => {
                const { productId, productName, productPrice } = addToCartBtn.dataset;
                // Ensure data attributes are present
                if (productId && productName && productPrice) {
                    // Call the global addToCart function
                    window.addToCart(productId, decodeURIComponent(productName), productPrice);
                } else {
                     console.error("addToCart data missing or invalid on detail page button:", addToCartBtn.dataset);
                     alert("Error: Could not add item to cart.");
                }
            });
        } else if (!window.addToCart) {
            console.error("Global addToCart function is missing! Cart functionality disabled.");
            // Optionally disable the button if the function is missing
            if(addToCartBtn) addToCartBtn.disabled = true;
        }

        // Copy Product ID Button Listener (Uses Global Copy Function)
        if (copyBtn && window.copyToClipboard) { // Check if global function exists
            copyBtn.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent potential event bubbling
                 const textToCopy = copyBtn.dataset.copyText; // Get text from data attribute
                 if (textToCopy) {
                     // Call the global copy function, passing the button for feedback context
                     window.copyToClipboard(textToCopy, copyBtn);
                 } else {
                      console.warn("No text found to copy from button data-copy-text attribute.");
                 }
            });
        } else if (!window.copyToClipboard) {
            console.error("Global copyToClipboard function is missing! Copy ID feature disabled.");
        }
    };

    // --- Populate Product Sliders ---

    /**
     * Creates HTML string for a product card suitable for sliders.
     * @param {object} product - The product data object.
     * @returns {string} HTML string for the slider card.
     */
    const createSliderCardHTML = (product) => {
        // Basic validation
        if (!product || typeof product.id !== 'string') return '';

         // Use global function for price calculation
         const { finalPrice, discountText, originalPrice, hasDiscount } = window.calculateDiscountedPrice(product.price, product.discount);
         const imageAlt = product.altText || product.name || 'Product image';
         // Use first image URL or a smaller placeholder for sliders
         const sliderImageUrl = (product.imageUrls && product.imageUrls.length > 0 && typeof product.imageUrls[0] === 'string' && product.imageUrls[0].trim())
                               ? product.imageUrls[0]
                               : 'https://via.placeholder.com/180x130/EEE/text=No+Image';
         const encodedName = encodeURIComponent(product.name || 'Unknown Product');

        // Generate card HTML (uses specific slider classes if needed by CSS)
        return `
             <article class="product-card slider-card" data-id="${product.id}">
                 <div class="product-card-top">
                     <a href="product-detail.html?id=${product.id}" class="product-card-link" aria-label="View details for ${product.name || 'product'}">
                         <div class="product-card-image-wrapper">
                             <img src="${sliderImageUrl}" alt="${imageAlt}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/180x130/FEE/text=Load+Error'; this.alt='Image failed to load';">
                         </div>
                         <h3>${product.name || 'Product Name'}</h3>
                         <div class="price-container">
                             ${hasDiscount ? `<span class="original-price">$${originalPrice.toFixed(2)}</span>` : ''}
                             <span class="discounted-price">$${finalPrice.toFixed(2)}</span>
                             ${discountText ? `<span class="discount-badge">${discountText}</span>` : ''}
                         </div>
                     </a>
                 </div>
                 <button type="button" class="add-to-cart-btn slider-add-to-cart" aria-label="Add ${product.name || 'product'} to cart"
                         data-product-id="${product.id}"
                         data-product-name="${encodedName}"
                         data-product-price="${finalPrice}">
                     <i class="fas fa-cart-plus"></i> Add
                 </button>
             </article>`;
    };

    /**
     * Populates a slider container with product cards and sets up delegated event listeners.
     * @param {HTMLElement} sliderElement - The container element for the slider.
     * @param {object[]} products - An array of product objects to display.
     */
    const populateSlider = (sliderElement, products) => {
        // Check if the slider container element exists
        if (!sliderElement) {
            // Log a warning if a specific slider is missing, but don't halt execution
            // console.warn("Slider element not found for population.");
            return;
        }
        // Handle cases with no products or invalid data
        if (!Array.isArray(products) || products.length === 0) {
            sliderElement.innerHTML = '<p style="font-size: 0.9em; color: var(--color-text-secondary); text-align: center; width: 100%;">No related products found.</p>';
            return;
        }

        // Generate HTML for all slider cards and set the container's innerHTML
        sliderElement.innerHTML = products.map(createSliderCardHTML).join('');

        // --- Add Delegated Event Listener for Slider Cart Buttons ---
        // Remove any previously attached listener to avoid duplicates if function is called again
        sliderElement.removeEventListener('click', handleSliderCartClick);
        // Attach the listener to the slider container
        sliderElement.addEventListener('click', handleSliderCartClick);
    };

    /**
     * Event handler for clicks within product sliders, specifically targeting add-to-cart buttons.
     * Uses event delegation.
     * @param {Event} event - The click event object.
     */
    const handleSliderCartClick = (event) => {
         // Find the closest ancestor button with the correct class
         const button = event.target.closest('.slider-add-to-cart');
         // Check if a valid button was clicked and the global addToCart function exists
         if (button && window.addToCart) {
             event.preventDefault(); // Prevent default action (e.g., link navigation)
             event.stopPropagation(); // Stop the event from bubbling further
             // Get product data from the button's data attributes
             const { productId, productName, productPrice } = button.dataset;
             // Ensure data is valid before adding to cart
             if (productId && productName && productPrice) {
                 window.addToCart(productId, decodeURIComponent(productName), productPrice);
             } else {
                 console.error("addToCart data missing or invalid on slider button:", button.dataset);
                 alert("Error: Could not add item to cart.");
             }
         } else if (button && !window.addToCart) {
              // Handle case where addToCart function is missing
              console.error("Global addToCart function is missing!");
              alert("Error: Cannot add item to cart at this time.");
         }
     };

    // --- Fetch and Process Data ---

    /** Fetches product data, populates the page, and handles errors. */
    const loadProductData = async () => {
        // Get product ID from the URL query string (?id=...)
        const urlParams = new URLSearchParams(window.location.search);
        const productIdFromUrl = urlParams.get('id');

        // If no ID is found in the URL, display an error and stop
        if (!productIdFromUrl) {
            displayDetailError("No product ID specified in the URL. Cannot load details.");
            return;
        }
        console.log("Attempting to load product with ID:", productIdFromUrl);

        // Show loading indicator
        if (loadingMsg) loadingMsg.style.display = 'block';

        try {
            // Fetch ALL products data.
            // NOTE: In a real-world scenario with a proper API, you would fetch only the specific
            // product using its ID (e.g., /api/products/${productIdFromUrl}) and related products separately.
            console.log("Fetching all products data from products.json...");
            const response = await fetch(`products.json?t=${Date.now()}`); // Add cache-busting

            // Check for HTTP errors
            if (!response.ok) {
                throw new Error(`Failed to fetch product list (Status: ${response.status})`);
            }
            // Parse the JSON response
            const allProducts = await response.json();

            // Validate that the fetched data is an array
            if (!Array.isArray(allProducts)) {
                 throw new Error("Invalid data format received from product list.");
            }
            // Store the full product list globally if needed elsewhere (e.g., shared search?)
            window.allProductsData = allProducts;

            // Find the specific product matching the ID from the URL
            const product = allProducts.find(p => p.id === productIdFromUrl);

            // If the product with the specified ID is not found
            if (!product) {
                displayDetailError(`Product with ID "${productIdFromUrl}" was not found.`);
                return; // Stop execution
            }

            // --- Product Found - Populate Page Sections ---
            console.log("Product found:", product.name);
            populateProductDetails(product); // Populate the main product content area

            // --- Add current product to Recently Viewed (after main details are populated) ---
            addRecentlyViewedId(product.id);

            // --- Populate Sliders ---
            // Recommended Slider (filter: same category, different ID)
            if (recommendedSlider) {
                const recommended = allProducts.filter(
                    p => p.category === product.category && p.id !== product.id
                ).slice(0, 8); // Limit to 8 items
                populateSlider(recommendedSlider, recommended);
            }

            // Trending Slider (filter: trending flag is true, different ID)
            if (trendingSlider) {
                const trending = allProducts.filter(
                    p => p.trending === true && p.id !== product.id
                ).slice(0, 8); // Limit to 8 items
                populateSlider(trendingSlider, trending);
            }

            // Recently Viewed Slider (filter: IDs from sessionStorage, exclude current)
            const recentIds = getRecentlyViewedIds().filter(id => id !== product.id); // Exclude current product
            if (recentIds.length > 0) {
                // Map the retrieved IDs back to the full product objects from our loaded data
                const recentlyViewedProducts = recentIds
                    .map(id => allProducts.find(p => p.id === id))
                    .filter(p => p !== undefined); // Filter out any products that might no longer exist
                populateSlider(recentlyViewedSlider, recentlyViewedProducts);
            } else {
                // Handle empty recently viewed state - populateSlider shows the message
                 populateSlider(recentlyViewedSlider, []);
            }

        } catch (error) {
            // Catch fetch errors, JSON parsing errors, or other issues
            console.error("Error loading or processing product data:", error);
            displayDetailError(`Failed to load product details. ${error.message || 'Please try refreshing the page.'}`);
        } finally {
            // Hide the loading message regardless of success or failure
            if(loadingMsg) loadingMsg.style.display = 'none';
        }
    };

    // --- Initial Setup ---

    // 1. Update cart display from localStorage (uses global function)
    if (window.updateCartDisplay) {
        window.updateCartDisplay();
    } else {
        console.error("Global function 'updateCartDisplay' not found. Cart display might be incorrect.");
    }

    // 2. Initialize common listeners (header, footer, auth, cart actions, etc.) (uses global function)
    if (typeof initializeCommonListeners === 'function') {
        initializeCommonListeners();
    } else {
         console.error("Global function 'initializeCommonListeners' not found. Common page features might not work correctly.");
         // Optionally display a subtle warning if critical UI depends on this
    }

    // 3. Fetch and display the specific product data for this detail page
    loadProductData();

}); // --- END DOMCONTENTLOADED (Detail Page) ---