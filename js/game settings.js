{
    const queryById = id => document.querySelector("#"+id);

    const appSettings = {};
    window.appSettings = appSettings;
    appSettings.getConfig = () => {
        return {
            numberOfHorizontalTiles: parseInt(queryById("width-input").value),
            numberOfVerticalTiles: parseInt(queryById("height-input").value),
            scrambleOnStart: queryById("scramble-on-start-input").checked,
            draggingMethod: queryById("dragging-method-input").value,
            style: {
                gradient: queryById("gradient-input").value,
                labels: "letters"
            }
        };
    };
    appSettings.applyConfig = config => {
        queryById("width-input").value = config.numberOfHorizontalTiles;
        queryById("height-input").value = config.numberOfVerticalTiles;
        queryById("scramble-on-start-input").checked = config.scrambleOnStart;
        queryById("dragging-method-input").value = config.draggingMethod;
        queryById("gradient-input").value = config.style.gradient;
    };
}

//config persistence
{
    const defaultConfig = {
        numberOfHorizontalTiles: 3,
        numberOfVerticalTiles: 3,
        scrambleOnStart: true,
        draggingMethod: "spring and snap",
        style: {
            gradient: "continuous",
            labels: "numbers"
        }
    };

    const loadConfig = () => {
        let config = { ...defaultConfig };
        let loaded = localStorage.getItem("torustiles-config");
        loaded = loaded ? JSON.parse(loaded) : {};
        config = { ...config, ...loaded };
        appSettings.applyConfig(config);
    };

    const saveConfig = () => {
        const config = appSettings.getConfig();
        localStorage.setItem("torustiles-config", JSON.stringify(config));
    };
    
    document.addEventListener("pageVisibilityChanged", e => {
        if (!e.detail.pageVisible) {
            saveConfig();
        }
    });
    revealHelper.addEventListener("revealStateChanged", e => {
        if (e.detail.revealState === "closed") {
            saveConfig();
        }
    });

    loadConfig();
}