$(function() {

	/* Build new ShopifyBuy client
	============================================================ */
	var client = ShopifyBuy.buildClient({
		apiKey: '248b922aeaee15d33c44aa3e657663f6', // Your SDK API/access token 
		domain: 'stickers-15.myshopify.com', // Your complete Shopify store domain
		appId: '6'
	});
	var product;
	var cart;
	var cartLineItemCount;
	
	//grab collection ID from div.collection#collection-id in HTML
	var collectionID = $('body').find('.collection').attr('id');
	
	// check for existing cart in local storage, if one doesn't exist
	// create new cart object
	if(localStorage.getItem('lastCartId')) {
		client.fetchCart(localStorage.getItem('lastCartId')).then(function(remoteCart) {
			cart = remoteCart;
			cartLineItemCount = cart.lineItems.length;
			renderCartItems();
		});
	} else {
		client.createCart().then(function (newCart) {
			cart = newCart;
			localStorage.setItem('lastCartId', cart.id);
			cartLineItemCount = 0;
		});
	}
	var previousFocusItem;


  	/* Fetch products in collection and loop through to create HTML for each product
  	======================================================================== */
	client.fetchQueryProducts({collection_id: collectionID, sort_by: 'collection-default' }).then(function(products) {
		
		// Products ==  the array of products within the collection
		for (i = 0; i < products.length; i++) {
			product = products[i];
			var productHTML = 	'<div class="product" id="buy-button-'+i+'" data-product-id = "'+ product.id+'">'+
									'<div class = "image-overlay-container">' +
										'<img class="variant-image pointer">'+
										'<div class = "image-overlay pointer"></div>' +
									'</div>' +
								  	'<div class = "product-details">'+
										'<h1 class="product-title pointer"></h1>'+
										'<h2 class="variant-title pointer"></h2>'+
										'<h2 class="variant-price"></h2>'+
								  	'</div>'+
									'<div class = "product-modal">'+
										'<div class = "modal-left"><img class="variant-image"></div>'+
										'<div class = "modal-right">'+
				   							'<h1 class="product-title"></h1>'+	
				   							'<h2 class="variant-title"></h2>'+
											'<h2 class="variant-price"></h2>'+
											'<div class = "product-description"></div>'+
					  						'<div class="variant-selectors"></div>'+
										'</div>'+
										'<div style = "clear:both"></div>'+'<i class="fa fa-times fa-2x product-modal-close" aria-hidden="true"></i>'+
										'<div class = "button-container">'+
											'<button class="btn buy-button js-prevent-cart-listener add-button" data-product-id = "'+product.id+'" data-variant-id = "'+ product.selectedVariant.id+'">Add To Cart</button>'+
									    '</div>'+
								   '</div>'+
								'</div>';
				
				
			$('.collection').append(productHTML);
			
			var selectedVariant = product.selectedVariant;
			var selectedVariantImage = product.selectedVariantImage;
			var varCount = product.variants.length;
			
			if (varCount > 1) {
				var variantSelectors = generateSelectors(i, product.variants);
				updateVariantSelectors(i, variantSelectors);
				updateVariantTitle(i, selectedVariant);
			}

			updateProductTitle(i, product.title);
			updateProductDescription(i, product.description);
			updateVariantImage(i, selectedVariantImage);
			updateVariantPrice(i, selectedVariant);
		}
		
		updateCartTabButton();
		bindEventListeners();
		attachOnVariantSelectListeners();
		updateCollectionTitle();
	});
	
	

	
  	/* Bind Event Listeners
  	============================================================ */
	function bindEventListeners() {
		
		// cart close button listener 
		$('.cart .btn--close').on('click', closeCart);

		// click away listener to close cart 
		$(document).on('click', function(evt) {
			if((!$(evt.target).closest('.cart').length) && (!$(evt.target).closest('.js-prevent-cart-listener').length)) {
				closeCart();
			}
		});

		// escape key handler 
		var ESCAPE_KEYCODE = 27;
		$(document).on('keydown', function (evt) {
			if (evt.which === ESCAPE_KEYCODE) {
				if (previousFocusItem) {
					$(previousFocusItem).focus();
					previousFocusItem = ''
				}
				closeCart();
			}
		});

		// checkout button click listener 
		$('.btn--cart-checkout').on('click', function () {
			var checkoutURL = cart.checkoutUrl;
			// if ($('input.cartAttribute').is(':checked')) {
			// 	var val = $('input.cartAttribute').val();
			// 	checkoutURL += '&attributes[ATTRIBUTE NAME]=' + val;
			// }
			var checkoutWindow = window.open(checkoutURL);
			window.addEventListener("message", checkoutPostMessageListener, checkoutWindow);
		});


		// buy button click listener 
		$('.buy-button').on('click', buyButtonClickHandler);

		// increment quantity click listener 
		$('.cart').on('click', '.quantity-increment', function () {
			var variantId = $(this).data('variant-id');
			incrementQuantity(variantId);
		});

		// decrement quantity click listener 
		$('.cart').on('click', '.quantity-decrement', function() {
			var variantId = $(this).data('variant-id');
			decrementQuantity(variantId);
		});

		// update quantity field listener 
		$('.cart').on('keyup', '.cart-item__quantity', debounce(fieldQuantityHandler, 250));

		// cart tab click listener 
		$('.btn--cart-tab').click(function() {
			setPreviousFocusItem(this);
			openCart();
		});
		
		// open product modal
		$('.collection').on('click', '.image-overlay, .variant-image, .product-details', function(){
			console.log('clicked');
			$(this).parents('.product').find('.product-modal').show();
			if (!$('.product-modal-underlay').length) {
				$('body').append('<div class = "product-modal-underlay"></div>');
			}
		});
		
		// close product modal
		$('body').on('click', '.product-modal-underlay, .product-modal-close', hideModal);
	}
	

	------------

	
	/* Event Listener handles post messages from checkout page
	============================================================ */
	function checkoutPostMessageListener(event) {
		var origin = event.origin || event.originalEvent.origin;
		
		if (origin !== 'https://checkout.shopify.com') {
			return;
		}

		var data = JSON.parse(event.data);
		
		if (data.current_checkout_page === '/checkout/thank_you') {
			cart.clearLineItems();
			
			/* enter in your home page here */
			//window.location = 'http://localhost/shopify-buy-sdk-example/';
		}
	}
	  
	
 	/* Attach and control listeners onto buy button
  	============================================================ */
	function buyButtonClickHandler(evt) {
	
		evt.preventDefault();
		var productID = $(this).attr('data-product-id');
		var variantID = $(this).attr('data-variant-id'); 
		var cartLineItem = findCartItemByVariantId(variantID);
		var quantity = cartLineItem ? cartLineItem.quantity + 1 : 1;
		
		client.fetchProduct(productID).then(function(product) {
		 	for (var i = 0; i < product.variants.length; i++) {
		 		if (product.variants[i].id == variantID) {
		 			variantObject = product.variants[i];
					addOrUpdateVariant(cartLineItem, variantObject, quantity);
					setPreviousFocusItem(evt.target);
					$('#checkout').focus();
		 		}
		 	}
		});
	}

  	/* Generate DOM elements for variant selectors
  	============================================================ */
	function generateSelectors(num, variants) {
		var options;

		for (var i = 0; i < variants.length; i++) {
			options += '<option value = "' + variants[i].id + '">' + variants[i].title + '</option>';
		}

		return 	'<select name = "variant-selection" class = "product' + num + '">' + options + '</select>';
	}

  	/* Variant option change handler
  	============================================================ */
	function attachOnVariantSelectListeners() {
		$('.collection').on('change', 'select[name=variant-selection]', function(event) {
			var element = $(this);
			var num = element.attr('class').replace("product", "");
			var productID = element.closest('.product').attr('data-product-id');
			var variantID = element.val();
			var variantName = element.find('option:selected').text();
			
			$('.add-button[data-product-id="'+ productID +'"]').attr('data-variant-id', variantID)
			
			client.fetchProduct(productID).then(function(product) {
			 	for (var i = 0; i < product.variants.length; i++) {
			 		if (product.variants[i].id == variantID) {
			 			var selectedVariant = product.variants[i];
						updateVariantImage(num, selectedVariant.image);
						updateVariantTitle(num, selectedVariant);
						updateVariantPrice(num, selectedVariant);
			 		}
			 	}
			});
		});
	}
	

	
	/* Update collection title
	/*************************************************************/
	function updateCollectionTitle() {
		client.fetchCollection(collectionID).then(function(collection) {
			var collectionTitle = collection.attrs.title;
			$('h2.collection-title').text(collectionTitle);
		});
	}
	

	/* Update product title
	============================================================ */
	function updateProductTitle(i, title) {
		$('#buy-button-'+i).find('.product-title').text(title);
	}

	/* Update product description
	============================================================ */
	function updateProductDescription(i, description) {
		$('#buy-button-'+i).find('.product-description').html(description);
	}

	/* Update product image based on selected variant
	============================================================ */
	function updateVariantImage(i, image) {
		var src = (image) ? image.src : ShopifyBuy.NO_IMAGE_URI;
		$('#buy-button-'+i).find('.variant-image').attr('src', src);
	}

	/* Update product variant title based on selected variant
	============================================================ */
	function updateVariantTitle(i, variant) {
		$('#buy-button-'+i).find('.variant-title').text(variant.title);
	}

	/* Update product variant price based on selected variant
	============================================================ */
	function updateVariantPrice(i, variant) {
		$('#buy-button-'+i).find('.variant-price').text('$' + variant.price);
	}

	/* Update product variant selectors 
	============================================================ */
	function updateVariantSelectors(i, variantSelectors) {
		$('#buy-button-'+i).find('.variant-selectors').html(variantSelectors);
	}
  

	
	/*************************************************************/
	
