<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;

class ValidationService
{
    /**
     * Numeric Validation
     */
    public static function validateNumeric($value, $min = null, $max = null, $allowDecimal = false)
    {
        // Check if value is numeric
        if (!is_numeric($value)) {
            return ['valid' => false, 'message' => 'Value must be numeric'];
        }

        // Check if positive
        if ($value < 0) {
            return ['valid' => false, 'message' => 'Value must be positive'];
        }

        // Check range
        if ($min !== null && $value < $min) {
            return ['valid' => false, 'message' => "Value must be at least $min"];
        }

        if ($max !== null && $value > $max) {
            return ['valid' => false, 'message' => "Value must not exceed $max"];
        }

        // Check if integer when required
        if (!$allowDecimal && !is_int($value) && $value != intval($value)) {
            return ['valid' => false, 'message' => 'Value must be an integer'];
        }

        return ['valid' => true];
    }

    /**
     * String Validation
     */
    public static function validateString($value, $minLength = null, $maxLength = null, $pattern = null)
    {
        // Check if empty
        if (empty($value)) {
            return ['valid' => false, 'message' => 'Value cannot be empty'];
        }

        // Check length
        $length = strlen($value);
        if ($minLength !== null && $length < $minLength) {
            return ['valid' => false, 'message' => "Value must be at least $minLength characters"];
        }

        if ($maxLength !== null && $length > $maxLength) {
            return ['valid' => false, 'message' => "Value must not exceed $maxLength characters"];
        }

        // Check pattern (regex)
        if ($pattern !== null && !preg_match($pattern, $value)) {
            return ['valid' => false, 'message' => 'Value does not match required format'];
        }

        return ['valid' => true];
    }

    /**
     * Email Validation
     */
    public static function validateEmail($email)
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['valid' => false, 'message' => 'Invalid email format'];
        }
        return ['valid' => true];
    }

    /**
     * Phone Validation (Vietnamese format)
     */
    public static function validatePhone($phone)
    {
        // Vietnamese phone: 10-11 digits starting with 0
        if (!preg_match('/^0[0-9]{9,10}$/', $phone)) {
            return ['valid' => false, 'message' => 'Invalid phone number format'];
        }
        return ['valid' => true];
    }

    /**
     * Date Validation
     */
    public static function validateDate($date, $format = 'Y-m-d', $minDate = null, $maxDate = null)
    {
        $d = \DateTime::createFromFormat($format, $date);
        if (!$d || $d->format($format) !== $date) {
            return ['valid' => false, 'message' => "Invalid date format. Expected: $format"];
        }

        $dateObj = new \DateTime($date);

        // Check if date is in future
        if ($minDate === 'future' && $dateObj <= new \DateTime()) {
            return ['valid' => false, 'message' => 'Date must be in the future'];
        }

        // Check if date is in past
        if ($maxDate === 'past' && $dateObj >= new \DateTime()) {
            return ['valid' => false, 'message' => 'Date must be in the past'];
        }

        // Check date range
        if ($minDate && is_string($minDate) && $minDate !== 'future') {
            $minDateObj = new \DateTime($minDate);
            if ($dateObj < $minDateObj) {
                return ['valid' => false, 'message' => "Date must be after $minDate"];
            }
        }

        if ($maxDate && is_string($maxDate) && $maxDate !== 'past') {
            $maxDateObj = new \DateTime($maxDate);
            if ($dateObj > $maxDateObj) {
                return ['valid' => false, 'message' => "Date must be before $maxDate"];
            }
        }

        return ['valid' => true];
    }

    /**
     * Date Range Validation
     */
    public static function validateDateRange($startDate, $endDate, $format = 'Y-m-d')
    {
        $start = \DateTime::createFromFormat($format, $startDate);
        $end = \DateTime::createFromFormat($format, $endDate);

        if (!$start || !$end) {
            return ['valid' => false, 'message' => 'Invalid date format'];
        }

        if ($start > $end) {
            return ['valid' => false, 'message' => 'Start date must be before or equal to end date'];
        }

        return ['valid' => true];
    }

    /**
     * Image Validation
     */
    public static function validateImage($file, $maxSizeMB = 2, $allowedFormats = ['jpeg', 'png', 'jpg'])
    {
        // Check if file exists
        if (!$file) {
            return ['valid' => false, 'message' => 'No file provided'];
        }

        // Check file size (convert MB to bytes)
        $maxSizeBytes = $maxSizeMB * 1024 * 1024;
        if ($file->getSize() > $maxSizeBytes) {
            return ['valid' => false, 'message' => "File size must not exceed {$maxSizeMB}MB"];
        }

        // Check file format
        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, $allowedFormats)) {
            $formats = implode(', ', $allowedFormats);
            return ['valid' => false, 'message' => "File format must be one of: $formats"];
        }

        // Check MIME type
        $mimeType = $file->getMimeType();
        $allowedMimes = ['image/jpeg', 'image/png'];
        if (!in_array($mimeType, $allowedMimes)) {
            return ['valid' => false, 'message' => 'Invalid image file'];
        }

        return ['valid' => true];
    }

    /**
     * Custom Coupon Code Validation
     * Student ID format: Must end with "81"
     */
    public static function validateStudentCoupon($code)
    {
        // Check if code ends with "81"
        if (!preg_match('/81$/', $code)) {
            return ['valid' => false, 'message' => 'Invalid coupon code. Code must end with "81"'];
        }

        // Check if code is numeric
        if (!is_numeric($code)) {
            return ['valid' => false, 'message' => 'Coupon code must be numeric'];
        }

        return ['valid' => true];
    }

    /**
     * Password Validation
     */
    public static function validatePassword($password)
    {
        $errors = [];

        if (strlen($password) < 8) {
            $errors[] = 'Password must be at least 8 characters';
        }

        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Password must contain at least one uppercase letter';
        }

        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Password must contain at least one lowercase letter';
        }

        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'Password must contain at least one number';
        }

        if (empty($errors)) {
            return ['valid' => true];
        }

        return ['valid' => false, 'messages' => $errors];
    }

    /**
     * Product Price Validation
     */
    public static function validateProductPrice($price)
    {
        $minPrice = 100000; // 100k VND
        $maxPrice = 10000000; // 10M VND

        $validation = self::validateNumeric($price, $minPrice, $maxPrice, true);
        if (!$validation['valid']) {
            return $validation;
        }

        return ['valid' => true];
    }

    /**
     * Stock Quantity Validation
     */
    public static function validateStockQuantity($quantity)
    {
        $validation = self::validateNumeric($quantity, 0, null, false);
        if (!$validation['valid']) {
            return $validation;
        }

        return ['valid' => true];
    }

    /**
     * Cart Item Quantity Validation
     */
    public static function validateCartQuantity($quantity, $availableStock)
    {
        $validation = self::validateNumeric($quantity, 1, $availableStock, false);
        if (!$validation['valid']) {
            return $validation;
        }

        return ['valid' => true];
    }
    public static function validateCouponCode($code)
{
    if (empty($code)) {
        return ['valid' => false, 'message' => 'Coupon code cannot be empty'];
    }

    if (!preg_match('/^[A-Z0-9_-]+$/', $code)) {
        return ['valid' => false, 'message' => 'Invalid coupon code format'];
    }

    return ['valid' => true];
}

public static function validateFutureDate($date)
{
    $validation = self::validateDate($date, 'Y-m-d', 'future');

    return $validation;
}
}
