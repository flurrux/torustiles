{
    const settingsContainer = document.querySelector("#settings-container");
    const settingsButton = document.querySelector("#settings-button");
    const revealHelper = new CircularRevealHelper(settingsButton, settingsContainer);
    window.revealHelper = revealHelper;
    settingsButton.addEventListener("click", () => revealHelper.toggleReveal());
}

//rotate settings icon
{
    const rotationElement = document.querySelector("#settings-icon-rotation-element");
    const setRotation = deg => {
        rotationElement.style.transform = `rotate(${deg}deg)`;
    };

    revealHelper.addEventListener("revealStateChanged", e => {
        const state = e.detail.revealState;
        if (state === "opening") {
            setRotation(-45);
        }
        else if (state === "closing") {
            setRotation(0);
        }
    });
}

//recolor settings icon for better contrast
{
    const settingsElement = document.querySelector("#settings-button");
    revealHelper.addEventListener("revealStateChanged", e => {
        const state = e.detail.revealState;
        if (state === "opening") {
            settingsElement.style.color = "#4a4848de";
        }
        else if (state === "closing") {
            settingsElement.style.color = "";
        }
    });
}