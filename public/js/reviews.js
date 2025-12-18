document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('reviewModal');
    const btn = document.getElementById('addReviewBtn');
    const span = document.getElementsByClassName('close')[0];

    btn.onclick = function() {
        modal.style.display = 'block';
    }

    span.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    document.getElementById('reviewForm').onsubmit = function(e) {
        e.preventDefault();
        const reviewText = document.getElementById('reviewText').value;
        console.log('Отзыв отправлен:', reviewText);
        modal.style.display = 'none';
    }

    fetch('/api/reviews')
        .then(response => response.json())
        .then(data => {
            const reviewsList = document.getElementById('reviewsList');
            data.forEach(review => {
                const div = document.createElement('div');
                div.textContent = review.text;
                reviewsList.appendChild(div);
            });
        });
});