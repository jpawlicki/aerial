import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-analytics.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";

const firebaseConfig = {
	apiKey: "AIzaSyC9tP9knLFIl9TMjQ_oRUtL9vng9M55qL8",
	authDomain: "aerial-2a159.firebaseapp.com",
	projectId: "aerial-2a159",
	storageBucket: "aerial-2a159.appspot.com",
	messagingSenderId: "265554731924",
	appId: "1:265554731924:web:60da6a635cb138e6832581",
	measurementId: "G-D5MV5P7VND"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
window.db = getDatabase(app);
