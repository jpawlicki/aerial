function getQueryParameter(key) {
	if (window.location.search == "") return undefined;
	for (let v of window.location.search.substring(1).query.split('&')) {
		let p = v.split('=');
		if (decodeURIComponent(p[0]) == key) return decodeURIComponent(p[1]);
	}
	return undefined;
}

function randKey(size) {
	let bytes = new Uint8Array(size);
	window.crypto.getRandomValues(bytes);
	return bytes.reduce((o, v) => o + ('00' + v.toString(16)).slice(-2), '');
}
