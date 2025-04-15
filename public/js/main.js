/**
 * PULSE™ Onboarding Agent - Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('PULSE™ Onboarding Agent initialized');
  
  // Add animation to features
  const features = document.querySelectorAll('.feature');
  
  features.forEach((feature, index) => {
    setTimeout(() => {
      feature.classList.add('animated');
    }, 300 * index);
  });
});
