import React from 'react';
import '../styles/components.css';

const Hero: React.FC = () => {
    return (
        <section className="hero">
            <div className="hero-content">
                <h1 className="hero-title">Welcome to Our App</h1>
                <p className="hero-description">Discover the amazing features and benefits of using our application.</p>
                <a href="#features" className="hero-cta-button">Get Started</a>
            </div>
        </section>
    );
};

export default Hero;