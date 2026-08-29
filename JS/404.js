// 404.js

document.addEventListener('DOMContentLoaded', () => {
  const btnReturnHome = document.getElementById('btnReturnHome');

  if (btnReturnHome) {
    // Simple hover interaction for the Return Home button
    btnReturnHome.addEventListener('mouseenter', () => {
      btnReturnHome.style.backgroundColor = '#000';
      btnReturnHome.style.color = '#fff';
      const icon = btnReturnHome.querySelector('.icon-return');
      if (icon) {
        // You can swap the icon source or add a filter if needed for dark mode
        icon.style.filter = 'invert(1)';
      }
    });

    btnReturnHome.addEventListener('mouseleave', () => {
      btnReturnHome.style.backgroundColor = 'transparent';
      btnReturnHome.style.color = '#000';
      const icon = btnReturnHome.querySelector('.icon-return');
      if (icon) {
        icon.style.filter = 'none';
      }
    });
  }

  // Navigate back to the landing page when pressing the "Enter" key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      window.location.href = '/';
    }
  });
  
  // Handle missing 404 graphics gracefully by showing CSS fallback
  const levelImages = document.querySelectorAll('.graphics-404 img');
  const fallback = document.querySelector('.fallback-404');
  
  let loadedImages = 0;
  let failedImages = 0;
  
  levelImages.forEach(img => {
    if(img.complete) {
      if(img.naturalWidth === 0) failedImages++;
      else loadedImages++;
    } else {
      img.addEventListener('load', () => loadedImages++);
      img.addEventListener('error', () => {
        failedImages++;
        if(failedImages > 0 && fallback) {
          fallback.style.display = 'block';
        }
      });
    }
  });
  
  // Initial check for cached missing images
  if (failedImages > 0 && fallback) {
    fallback.style.display = 'block';
  } else if (fallback) {
    fallback.style.display = 'none';
  }
});
