import { useEffect } from "react";

export default function ScrollRevealInit() {
  useEffect(() => {
    const scrollElements = document.querySelectorAll(".reveal-scroll");
    if (
      typeof window !== "undefined" &&
      "IntersectionObserver" in window &&
      scrollElements.length > 0
    ) {
      const scrollObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          root: null,
          rootMargin: "0px 0px -60px 0px",
          threshold: 0.1,
        },
      );
      scrollElements.forEach((el) => scrollObserver.observe(el));
      return () => scrollObserver.disconnect();
    } else {
      scrollElements.forEach((el) => el.classList.add("is-visible"));
    }
  }, []);

  return null;
}
