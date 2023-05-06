class MouseInputs {
    // initialiser les variables
    offsetX;
    offsetY;
    startX;
    startY;
    isDragging = false;

    constructor(canvas, beginCallback, moveCallback, endCallback) {
        // ajouter un écouteur d'événements pour la souris
        canvas.addEventListener("mousedown", function (event) {
            // enregistrer les coordonnées de départ
            this.offsetX = this.startX = event.clientX;
            this.offsetY = this.startY = event.clientY;
            this.isDragging = true;
            beginCallback(this, this.offsetX, this.offsetY);
        });

        canvas.addEventListener("mousemove", function (event) {
            if (this.isDragging) {
                // calculer le décalage
                const dx = event.clientX - this.offsetX;
                const dy = event.clientY - this.offsetY;

                // mettre à jour les variables de décalage
                this.offsetX += dx;
                this.offsetY += dy;

                moveCallback(this, dx, dy);
            }
        });

        canvas.addEventListener("mouseup", function (event) {
            this.isDragging = false;
            endCallback(this, this.offsetX - this.startX, this.offsetY - this.startY);
        });
    }
}
