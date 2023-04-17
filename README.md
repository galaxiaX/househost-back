# Househost ✨

Live at: [househost.vercel.app](https://househost.vercel.app)

## Frontend 🏠

The frontend for this project can be found at [github.com/galaxiaX/househost-front](https://github.com/galaxiaX/househost-front) . It was built with Vite and React and is deployed on Vercel.

## Backend 🔧

This repository contains the backend code for Househost, a web application for managing rental properties. The backend was built with Node.js, Express, and MongoDB, and it stores images in AWS S3.

### Getting Started 💻

To get started with the project, follow these steps:

1.Clone the repository:

```bash
git clone https://github.com/galaxiaX/househost-back.git
```

2.Install dependencies:

```bash
npm install
```

3.Create a .env file with the following environment variables:

```env
MONGO_URL=<your-mongodb-url>
JWT_SECRET=<your-jwt-secret>
BUCKET_NAME=<your-aws-s3-bucket-name>
BUCKET_REGION=<your-aws-s3-bucket-region>
ACCESS_KEY=<your-aws-access-key>
SECRET_ACCESS_KEY=<your-aws-secret-access-key>
IMG_URL=<your-aws-s3-image-url>
```

4.Run the development server:

```bash
nodemon index.js
```

This will start the development server at `http://localhost:3000`.

### Deployment 🚀

The project is deployed on Vercel whenever changes are pushed to the main branch. You can deploy the project manually by running the following command:

```bash
npm run build
```

This will generate a production build in the build directory. You can then deploy this directory to your preferred hosting platform.
