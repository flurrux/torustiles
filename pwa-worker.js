//Install stage sets up the offline page in the cache and opens a new cache
self.addEventListener('install', function (event) {
	var offlinePage = new Request('index.html');
	event.waitUntil(
		caches.open('torustiles-offline').then(cache => {
			console.log('[PWA Builder] Cached offline page during Install' + response.url);
			return cache.addAll([
				"index.html",
				"libs/icon.css",
				"libs/material.brown-deep_orange.min.css",
				"libs/material.min.js",
				"css/style.css",
				"js/MathUtil.js",
				"js/Rect2D.js",
				"js/Vector2D.js",
				"js/Animation.js",
				"js/DragHelper.js",
				"js/DraggableNumber.js",
				"js/CtxUtil.js",
				"js/CircularRevealHelper.js"
			])
		})
	)
});

//If any fetch fails, it will show the offline page.
//Maybe this should be limited to HTML documents?
self.addEventListener('fetch', function (event) {
	event.respondWith(
		fetch(event.request).catch(function (error) {
			console.error('[PWA Builder] Network request Failed. Serving offline page ' + error);
			return caches.open('torustiles-offline').then(function (cache) {
				return cache.match('offline.html');
			});
		}
	));
});

//This is a event that can be fired from your page to tell the SW to update the offline page
self.addEventListener('refreshOffline', function (response) {
	return caches.open('torustiles-offline').then(function (cache) {
		console.log('[PWA Builder] Offline page updated from refreshOffline event: ' + response.url);
		return cache.put(offlinePage, response);
	});
});
