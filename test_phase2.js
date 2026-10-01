const testPhase2 = async () => {
    try {
        console.log("1. Logging in as Admin...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: "admin@digicoders.com", password: "706876" })
        });
        const loginData = await loginRes.json();
        
        if (!loginData.token) {
            console.error("Login failed:", loginData);
            return;
        }
        const token = loginData.token;
        console.log("Login Success! Token received.");

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        console.log("\n2. Testing POST /api/master/products");
        const prodRes = await fetch('http://localhost:5000/api/master/products', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: "Website Development", price: 15000, description: "Dynamic Website" })
        });
        console.log("Product Status:", prodRes.status, await prodRes.json());

        console.log("\n3. Testing POST /api/master/services");
        const servRes = await fetch('http://localhost:5000/api/master/services', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: "SEO Optimization", price: 5000 })
        });
        console.log("Service Status:", servRes.status, await servRes.json());

        console.log("\n4. Testing POST /api/master/departments");
        const deptRes = await fetch('http://localhost:5000/api/master/departments', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: "Installation Team", description: "Handles on-site setup" })
        });
        console.log("Department Status:", deptRes.status, await deptRes.json());

        console.log("\n5. Testing GET /api/master/settings");
        const setRes = await fetch('http://localhost:5000/api/master/settings', {
            method: 'GET',
            headers
        });
        console.log("Settings GET Status:", setRes.status, await setRes.json());

    } catch (err) {
        console.error("Test Script Error:", err);
    }
};

testPhase2();
