import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import Testimonials from '../components/Testimonials';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

const Home: React.FC = () => {
    return (
        <div>
            <Navbar />
            <Hero />
            <Features />
            <Testimonials />
            <Footer />
        </div>
    );
};

export default Home;