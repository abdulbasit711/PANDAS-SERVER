const asyncHandler = (requestHandler) => {
    // return (req, res, next) => {
    return async (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch(err => next(err))
    };
}

export { asyncHandler }
// second way

// const asyncHandler = (requestHandler) => {
//     return async (req, res, next) => {
//         try {
//             await requestHandler(req, res, next);
//         } catch (error) {
//             next(error);
//         }
//     };
// }