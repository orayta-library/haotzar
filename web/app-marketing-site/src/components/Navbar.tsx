import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/components.css';

const Navbar: React.FC = () => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/" className="navbar-item">
                    <h1>YourAppName</h1>
                </Link>
            </div>
            <div className="navbar-menu">
                <Link to="/" className="navbar-item">Home</Link>
                <Link to="/about" className="navbar-item">About</Link>
                <Link to="/contact" className="navbar-item">Contact</Link>
            </div>
        </nav>
    );
};

export default Navbar;