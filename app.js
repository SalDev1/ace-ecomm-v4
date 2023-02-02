const express = require("express");
const products = require("./routes/productRoute");
const errorMiddleware = require("./middleware/error");
const user = require("./routes/userRoute");
const cookieParser = require("cookie-parser");
const order = require("./routes/orderRoute");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const payment = require("./routes/paymentRoute");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

var app = express();

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(cors());

app.use("/api/v1", products);
app.use("/api/v1", user);
app.use("/api/v1", order);
app.use("/api/v1", payment);

// For deployment purposes.
/*
  As React only changes the component in the frontend , meaning
  everything works in the single page.
 */
dotenv.config();

app.use(express.static(path.join(__dirname, "./client/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "./client/build/index.html"));
});
// Middleware for error.
app.use(errorMiddleware);

app.get("/", (req, res) => {
  res.json("Welcome to the API");
});

module.exports = app;
