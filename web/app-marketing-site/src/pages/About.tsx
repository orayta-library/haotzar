import React from 'react';
import '../styles/components.css';

const About: React.FC = () => {
    return (
        <div className="about-container">
            <h1>About Our Application</h1>
            <p>
                Welcome to our application! We are dedicated to providing the best experience for our users.
                Our app is designed with the latest technologies and user-friendly interfaces to ensure
                that you can achieve your goals efficiently.
            </p>
            <h2>Our Mission</h2>
            <p>
                Our mission is to empower users by providing innovative solutions that enhance productivity
                and simplify tasks. We believe in continuous improvement and value user feedback to shape
                our development.
            </p>
            <h2>Our Team</h2>
            <p>
                We are a team of passionate individuals with diverse backgrounds in technology, design, and
                user experience. Together, we strive to create a product that meets the needs of our users
                and exceeds their expectations.
            </p>
        </div>
    );
};

export default About;