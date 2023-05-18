class MouseWheelInputs {
    constructor(canvas, o) {
        // ajouter un écouteur d'événements pour la souris
        canvas.addEventListener("wheel", function (event) {
            event.preventDefault(); // prevent default scrolling behavior
            const deltaY = o.inc ? (event.deltaY < 0 ? -o.inc : o.inc) : event.deltaY; // get the amount of delta in the Y direction, assuming it's pixel.
            if (o.onwheel) {
                o.onwheel(this, deltaY);
            }
        });
    }
}

class MouseDragInputs {
    // initialiser les variables
    offsetX;
    offsetY;
    startX;
    startY;
    isDragging = false;
    button;

    constructor(canvas, o) {
        // ajouter un écouteur d'événements pour la souris
        canvas.addEventListener("mousedown", function (event) {
            // enregistrer les coordonnées de départ
            this.offsetX = this.startX = event.clientX;
            this.offsetY = this.startY = event.clientY;
            this.button = event.button;
            this.isDragging = true;
            if (o.onbegin) {
                o.onbegin(this, this.offsetX, this.offsetY, this.button);
            }
        });

        canvas.addEventListener("mousemove", function (event) {
            if (this.isDragging) {
                // calculer le décalage
                const dx = event.clientX - this.offsetX;
                const dy = event.clientY - this.offsetY;

                // mettre à jour les variables de décalage
                this.offsetX += dx;
                this.offsetY += dy;

                if (o.ondrag) {
                    o.ondrag(this, dx, dy, this.button);
                }
            }
        });

        canvas.addEventListener("mouseup", function (event) {
            this.isDragging = false;
            if (o.onend) {
                o.onend(this, this.offsetX - this.startX, this.offsetY - this.startY, this.button);
            }
        });
    }
}
