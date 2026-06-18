(function ($) {
	var SLOT_COUNT = 6;
	var SIDE_SLOT_COUNT = 3;
	var REMEMBERED_USER_KEY = "dbTalentCalc.rememberedUser.v1";
	var SAVE_PREFIX = "dbTalentCalc.saveSlots.v2.";
	var memoryStorage = {};
	var currentUser = "";
	var currentProfileKey = "";
	var lastSignature = "";

	function normalizeUserName(value) {
		return $.trim(value || "").replace(/\s+/g, " ");
	}

	function getPassword(value) {
		return value || "";
	}

	function hashString(value) {
		var hash = 0;
		for (var i = 0; i < value.length; i++) {
			hash = ((hash << 5) - hash) + value.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash).toString(36);
	}

	function makeProfileKey(userName, password) {
		return encodeURIComponent(userName.toLowerCase()) + "." + hashString(userName + "\n" + password);
	}

	function storageGet(key) {
		try {
			return window.localStorage.getItem(key);
		} catch (error) {
			return memoryStorage[key] || null;
		}
	}

	function storageSet(key, value) {
		try {
			window.localStorage.setItem(key, value);
		} catch (error) {
			memoryStorage[key] = value;
		}
	}

	function storageRemove(key) {
		try {
			window.localStorage.removeItem(key);
		} catch (error) {
			delete memoryStorage[key];
		}
	}

	function getCurrentDisciplineId() {
		if (window.DBCalc && typeof DBCalc.currentDisciplineID === "number" && DBCalc.currentDisciplineID >= 0) {
			return DBCalc.currentDisciplineID;
		}
		return 3;
	}

	function getCurrentDiscipline() {
		if (window.DBCalc && DBCalc.currentDiscipline) return DBCalc.currentDiscipline;
		if (window.DBCalc && DBCalc.disciplines && DBCalc.currentDisciplineID >= 0) {
			return DBCalc.disciplines[DBCalc.currentDisciplineID];
		}
		return "Build";
	}

	function getUserKey() {
		return SAVE_PREFIX + currentProfileKey + ".discipline." + getCurrentDisciplineId();
	}

	function getEmptySlots() {
		var slots = [];
		for (var i = 0; i < SLOT_COUNT; i++) slots.push(null);
		return slots;
	}

	function readSlots() {
		var slots = getEmptySlots();
		var raw = currentProfileKey ? storageGet(getUserKey()) : null;

		if (raw) {
			try {
				var parsed = JSON.parse(raw);
				if ($.isArray(parsed)) {
					for (var i = 0; i < SLOT_COUNT; i++) slots[i] = parsed[i] || null;
				}
			} catch (error) {
				slots = getEmptySlots();
			}
		}

		return slots;
	}

	function writeSlots(slots) {
		if (!currentProfileKey) return;
		storageSet(getUserKey(), JSON.stringify(slots.slice(0, SLOT_COUNT)));
	}

	function getCurrentHash() {
		if (typeof encodeBuild === "function") return encodeBuild();
		return window.location.hash || "#3";
	}

	function getCurrentPoints() {
		if (window.DBCalc && typeof DBCalc.points_spent === "number") return DBCalc.points_spent;
		return 0;
	}

	function getCurrentSignature() {
		return getCurrentHash() + "|" + getCurrentDisciplineId() + "|" + getCurrentPoints();
	}

	function formatSavedAt(value) {
		if (!value) return "";
		var date = new Date(value);
		if (isNaN(date.getTime())) return "";
		return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	function updateCurrentBuild() {
		var discipline = getCurrentDiscipline();
		$("#save_current_name").text(discipline);
		$("#save_discipline_name").text(discipline);
		$("#save_discipline_meta").text(SLOT_COUNT + " slots");
		$("#save_current_meta").text(getCurrentPoints() + " points | " + getCurrentHash());
	}

	function createSlotElement(slot, index, currentHash) {
		var isEmpty = !slot;
		var isActive = slot && slot.hash === currentHash;
		var $slot = $("<div>").addClass("save-slot").toggleClass("empty", isEmpty).toggleClass("active", !!isActive);
		var $number = $("<div>").addClass("save-slot-number").text("#" + (index + 1));
		var $name = $("<div>").addClass("save-slot-name").text(slot && slot.name ? slot.name : "Empty slot");
		var meta = "No saved " + getCurrentDiscipline() + " build";

		if (slot) {
			meta = (slot.points || 0) + " points";
			if (slot.savedAt) meta += "\n" + formatSavedAt(slot.savedAt);
		}

		var $meta = $("<div>").addClass("save-slot-meta").text(meta);
		var $actions = $("<div>").addClass("save-slot-actions");
		var $load = $("<button>").attr({ type: "button", "data-action": "load", "data-slot": index }).addClass("save-button").prop("disabled", isEmpty).text("Load");
		var $save = $("<button>").attr({ type: "button", "data-action": "save", "data-slot": index }).addClass("save-button primary").text(isEmpty ? "Save" : "Overwrite");
		var $rename = $("<button>").attr({ type: "button", "data-action": "rename", "data-slot": index }).addClass("save-button").prop("disabled", isEmpty).text("Rename");
		var $delete = $("<button>").attr({ type: "button", "data-action": "delete", "data-slot": index }).addClass("save-button danger").prop("disabled", isEmpty).text("Delete");

		$actions.append($load, $save, $rename, $delete);
		$slot.append($number, $name, $meta, $actions);
		return $slot;
	}

	function renderSlots() {
		var slots = readSlots();
		var currentHash = getCurrentHash();
		var $leftSlots = $("#save_slots_left").empty();
		var $rightSlots = $("#save_slots_right").empty();

		for (var i = 0; i < SLOT_COUNT; i++) {
			var $slot = createSlotElement(slots[i], i, currentHash);
			if (i < SIDE_SLOT_COUNT) $leftSlots.append($slot);
			else $rightSlots.append($slot);
		}
	}

	function renderAll() {
		if (!currentProfileKey) return;
		$("#save_user_name").text(currentUser);
		updateCurrentBuild();
		renderSlots();
		lastSignature = getCurrentSignature();
	}

	function saveSlot(index) {
		var slots = readSlots();
		var oldSlot = slots[index];
		var name = oldSlot && oldSlot.name ? oldSlot.name : getCurrentDiscipline() + " Build";

		slots[index] = {
			name: name,
			hash: getCurrentHash(),
			disciplineId: getCurrentDisciplineId(),
			discipline: getCurrentDiscipline(),
			points: getCurrentPoints(),
			savedAt: new Date().toISOString()
		};

		writeSlots(slots);
		renderAll();
	}

	function loadSlot(index) {
		var slot = readSlots()[index];
		if (!slot || !slot.hash) return;

		var hash = slot.hash.charAt(0) === "#" ? slot.hash : "#" + slot.hash;
		if (typeof decodeBuild === "function" && typeof switchDiscipline === "function") {
			var build = decodeBuild(hash);
			if (build) {
				window.location.hash = hash;
				if (window.DBCalc) DBCalc.hash = hash;
				switchDiscipline(build.discipline_id, build.slots);
			}
		} else {
			window.location.hash = hash;
		}

		setTimeout(renderAll, 350);
	}

	function renameSlot(index) {
		var slots = readSlots();
		var slot = slots[index];
		if (!slot) return;

		var nextName = normalizeUserName(window.prompt("Rename save slot", slot.name || ""));
		if (!nextName) return;

		slot.name = nextName;
		writeSlots(slots);
		renderAll();
	}

	function deleteSlot(index) {
		var slots = readSlots();
		var slot = slots[index];
		if (!slot) return;
		if (!window.confirm("Delete " + (slot.name || "this save slot") + "?")) return;

		slots[index] = null;
		writeSlots(slots);
		renderAll();
	}

	function login(name, password) {
		currentUser = normalizeUserName(name);
		password = getPassword(password);

		if (!currentUser) {
			$("#login_error").text("Enter a username.");
			return;
		}

		if (!password) {
			$("#login_error").text("Enter a password.");
			return;
		}

		currentProfileKey = makeProfileKey(currentUser, password);
		storageSet(REMEMBERED_USER_KEY, currentUser);
		$("#login_error").text("");
		$("#login_password").val("");
		$("#login_screen").addClass("hidden");
		renderAll();
	}

	function loginAsGuest() {
		currentUser = "Guest";
		currentProfileKey = makeProfileKey(currentUser, "guest");
		storageSet(REMEMBERED_USER_KEY, currentUser);
		$("#login_error").text("");
		$("#login_name").val(currentUser);
		$("#login_password").val("");
		$("#login_screen").addClass("hidden");
		renderAll();
	}

	function showLogin() {
		var lastUser = normalizeUserName(storageGet(REMEMBERED_USER_KEY));
		currentUser = "";
		currentProfileKey = "";
		$("#login_name").val(lastUser);
		$("#login_password").val("");
		$("#login_error").text("");
		$("#login_screen").removeClass("hidden");
		setTimeout(function () {
			if (lastUser) $("#login_password").focus();
			else $("#login_name").focus();
		}, 0);
	}

	function bindEvents() {
		$("#login_form").on("submit", function (event) {
			event.preventDefault();
			login($("#login_name").val(), $("#login_password").val());
		});

		$("#guest_login_button").on("click", function () {
			loginAsGuest();
		});

		$("#logout_button").on("click", function () {
			showLogin();
		});

		$("#save_slots_left, #save_slots_right").on("click", "button[data-action]", function () {
			var $button = $(this);
			if ($button.prop("disabled")) return;

			var index = parseInt($button.attr("data-slot"), 10);
			var action = $button.attr("data-action");

			if (action === "save") saveSlot(index);
			if (action === "load") loadSlot(index);
			if (action === "rename") renameSlot(index);
			if (action === "delete") deleteSlot(index);
		});
	}

	function watchBuildChanges() {
		setInterval(function () {
			if (!currentProfileKey) return;

			var signature = getCurrentSignature();
			if (signature !== lastSignature) {
				updateCurrentBuild();
				renderSlots();
				lastSignature = signature;
			}
		}, 500);
	}

	$(document).ready(function () {
		bindEvents();
		watchBuildChanges();
		showLogin();
	});
})(jQuery);
