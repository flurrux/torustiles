if (navigator.serviceWorker.controller) {
	console.log('[PWA Builder] active service worker found, no need to register')
} 
else {
	//Register the ServiceWorker
	navigator.serviceWorker.register('pwa-worker.js', { scope: './' })
	.then(function (reg) {
		console.log('Service worker has been registered for scope:' + reg.scope);
	});
}
